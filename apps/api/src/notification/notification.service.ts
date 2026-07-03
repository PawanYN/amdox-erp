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
 *  1. IN_APP — always: creates a Notification record readable by /notifications
 *  2. WEBHOOK — when tenant.settings.webhookUrl is configured: HMAC-signed HTTP POST
 *
 * INT-07: All → Notifications integration.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationEngine');
  private prisma = new PrismaClient();

  constructor(private readonly webhookChannel: WebhookChannel) {}

  async notify(input: NotifyInput) {
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

    // 4. Dispatch webhook if tenant has one configured
    await this.dispatchWebhookIfConfigured(notification.id, input);

    return notification;
  }

  private async dispatchWebhookIfConfigured(notificationId: string, input: NotifyInput) {
    try {
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
          failedAt: ok ? undefined : new Date(),
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
}
