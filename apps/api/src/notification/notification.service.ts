import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, NotificationChannel, NotificationDeliveryStatus } from '@amdox/db';
import { WebhookChannel } from './channels/webhook.channel';

export interface NotifyInput {
  tenantId: string;
  eventType: string;
  title: string;
  body?: string;
  userId?: string;
}

/**
 * Central notification dispatch service.
 *
 * Delivery channels:
 *  1. IN_APP — creates a Notification record readable by /notifications
 *  2. WEBHOOK — when tenant.settings.webhookUrl is configured: HMAC-signed HTTP POST
 *
 * Each channel is skipped if the target user has an explicit NotificationPreference
 * row disabling it for that eventType. No preference row means the channel defaults
 * to enabled (opt-out model, matching NotificationPreference.isEnabled's schema
 * default). Preferences only apply when a specific userId is known — tenant-wide
 * broadcast events with no target user always go through, since there's no
 * individual to opt out.
 *
 * INT-07: All → Notifications integration.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationEngine');
  private prisma = new PrismaClient();

  constructor(private readonly webhookChannel: WebhookChannel) {}

  private async isChannelEnabled(
    userId: string | undefined,
    eventType: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    if (!userId) return true;
    const pref = await this.prisma.notificationPreference.findFirst({
      where: { userId, eventType, channel },
      select: { isEnabled: true },
    });
    return pref?.isEnabled ?? true;
  }

  async notify(input: NotifyInput) {
    const inAppEnabled = await this.isChannelEnabled(
      input.userId,
      input.eventType,
      NotificationChannel.IN_APP,
    );
    if (!inAppEnabled) {
      this.logger.log(
        `[NOTIFICATION] ${input.eventType} suppressed for user=${input.userId} — IN_APP disabled by NotificationPreference`,
      );
      return null;
    }

    // 1. Persist in-app notification
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        eventType: input.eventType,
        title: input.title,
        body: input.body,
      },
    });

    // 2. Always log to terminal (dev visibility)
    this.logger.log(
      `[NOTIFICATION] ${input.eventType} | ${input.title}${input.body ? ` — ${input.body}` : ''} | tenant=${input.tenantId}`,
    );

    // 3. Mark IN_APP delivery
    await this.prisma.notificationDelivery.create({
      data: {
        tenantId: input.tenantId,
        notificationId: notification.id,
        channel: NotificationChannel.IN_APP,
        status: NotificationDeliveryStatus.SENT,
        attempts: 1,
        sentAt: new Date(),
      },
    });

    // 4. Dispatch webhook if tenant has one configured and user hasn't opted out
    await this.dispatchWebhookIfConfigured(notification.id, input);

    return notification;
  }

  private async dispatchWebhookIfConfigured(notificationId: string, input: NotifyInput) {
    try {
      const webhookEnabled = await this.isChannelEnabled(
        input.userId,
        input.eventType,
        NotificationChannel.WEBHOOK,
      );
      if (!webhookEnabled) return;

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { settings: true },
      });

      const settings = tenant?.settings as Record<string, unknown> | null;
      const webhookUrl = settings?.webhookUrl as string | undefined;
      const signingSecret = (settings?.webhookSecret as string | undefined) ?? input.tenantId;

      if (!webhookUrl) return;

      const payload = {
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        tenantId: input.tenantId,
        userId: input.userId,
        timestamp: new Date().toISOString(),
      };

      const ok = await this.webhookChannel.dispatch(webhookUrl, signingSecret, payload);

      await this.prisma.notificationDelivery.create({
        data: {
          tenantId: input.tenantId,
          notificationId,
          channel: NotificationChannel.WEBHOOK,
          status: ok ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.FAILED,
          attempts: 1,
          sentAt: ok ? new Date() : undefined,
          lastError: ok ? undefined : 'Webhook dispatch failed',
        },
      });
    } catch (err: any) {
      this.logger.error(`Webhook dispatch error: ${err?.message}`);
    }
  }

  async listForTenant(tenantId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { deliveries: true },
    });
  }

  async markRead(tenantId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, tenantId },
      data: { isRead: true },
    });
  }

  async listPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({ where: { userId } });
  }

  async setPreference(
    tenantId: string,
    userId: string,
    eventType: string,
    channel: NotificationChannel,
    isEnabled: boolean,
  ) {
    const existing = await this.prisma.notificationPreference.findFirst({
      where: { userId, eventType, channel },
    });
    if (existing) {
      return this.prisma.notificationPreference.update({
        where: { id: existing.id },
        data: { isEnabled },
      });
    }
    return this.prisma.notificationPreference.create({
      data: { tenantId, userId, eventType, channel, isEnabled },
    });
  }
}
