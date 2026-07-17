import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Subject } from 'rxjs';
import { prisma, NotificationChannel, NotificationDeliveryStatus, Notification } from '@amdox/db';
import { QUEUE_NAMES } from '../infrastructure/queues/queue-names';

export interface NotifyInput {
  tenantId: string;
  eventType: string;
  title: string;
  body?: string;
  userId?: string;
}

export interface NotificationStreamEvent {
  tenantId: string;
  userId?: string;
  notification: Notification;
}

export interface DispatchJobData {
  deliveryId: string;
  channel: NotificationChannel;
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
 *  1. IN_APP — creates a Notification record readable by /notifications, and
 *     pushed live over SSE (`GET /notifications/stream`) to connected clients.
 *  2. WEBHOOK / EMAIL / SMS — dispatched asynchronously via the `notification-dispatch`
 *     BullMQ queue (see NotificationDispatchProcessor) instead of inline, so a
 *     transient failure (network blip, tenant endpoint down) gets retried with
 *     backoff instead of being marked FAILED once and forgotten. Jobs that
 *     exhaust their retries are kept (not auto-removed) and stay visible in the
 *     Bull Board dashboard mounted at /admin/queues — the dead-letter view.
 *     EMAIL uses Nodemailer (Mailpit in dev, real SMTP in prod). SMS uses an
 *     optional HTTP webhook provider (SMS_WEBHOOK_URL) or logs in dev.
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
  private readonly stream$ = new Subject<NotificationStreamEvent>();

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATION_DISPATCH) private readonly dispatchQueue: Queue,
  ) {}

  getStream() {
    return this.stream$.asObservable();
  }

  private async isChannelEnabled(
    tenantId: string,
    userId: string | undefined,
    eventType: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    if (!userId) return true;
    const pref = await prisma.notificationPreference.findFirst({
      where: { userId, eventType, channel, tenantId },
      select: { isEnabled: true },
    });
    return pref?.isEnabled ?? true;
  }

  async notify(input: NotifyInput) {
    const inAppEnabled = await this.isChannelEnabled(
      input.tenantId,
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
    const notification = await prisma.notification.create({
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
    await prisma.notificationDelivery.create({
      data: {
        tenantId: input.tenantId,
        notificationId: notification.id,
        channel: NotificationChannel.IN_APP,
        status: NotificationDeliveryStatus.SENT,
        attempts: 1,
        sentAt: new Date(),
      },
    });

    // 4. Push live over SSE to any connected client for this tenant/user
    this.stream$.next({ tenantId: input.tenantId, userId: input.userId, notification });

    // 5. Queue webhook dispatch if tenant has one configured and user hasn't opted out
    await this.enqueueIfEligible(notification.id, input, NotificationChannel.WEBHOOK);

    // 6. Queue email dispatch if the target user has an address on file and hasn't opted out
    await this.enqueueIfEligible(notification.id, input, NotificationChannel.EMAIL);

    // 7. Queue SMS dispatch when user has a phone on file (stored in tenant settings per user)
    await this.enqueueIfEligible(notification.id, input, NotificationChannel.SMS);

    return notification;
  }

  /**
   * Checks channel-specific eligibility (preference + whether there's actually
   * somewhere to send it), then hands the real dispatch off to the
   * `notification-dispatch` BullMQ queue so a transient failure gets retried
   * with backoff instead of being marked FAILED once and forgotten.
   */
  private async enqueueIfEligible(
    notificationId: string,
    input: NotifyInput,
    channel: Extract<NotificationChannel, 'WEBHOOK' | 'EMAIL' | 'SMS'>,
  ) {
    try {
      const enabled = await this.isChannelEnabled(
        input.tenantId,
        input.userId,
        input.eventType,
        channel,
      );
      if (!enabled) return;

      if (channel === NotificationChannel.WEBHOOK) {
        // tenant-scope-ok: Tenant model has no tenantId field (it IS the tenant).
        const tenant = await prisma.tenant.findUnique({
          where: { id: input.tenantId },
          select: { settings: true },
        });
        const settings = tenant?.settings as Record<string, unknown> | null;
        if (!settings?.webhookUrl) return;
      }

      if (channel === NotificationChannel.EMAIL) {
        if (!input.userId) return;
        const user = await prisma.user.findFirst({
          where: { id: input.userId, tenantId: input.tenantId },
          select: { email: true },
        });
        if (!user?.email) return;
      }

      if (channel === NotificationChannel.SMS) {
        if (!input.userId) return;
        const phone = await this.resolveUserPhone(input.tenantId, input.userId);
        if (!phone) return;
      }

      const delivery = await prisma.notificationDelivery.create({
        data: {
          tenantId: input.tenantId,
          notificationId,
          channel,
          status: NotificationDeliveryStatus.PENDING,
          attempts: 0,
        },
      });

      const jobData: DispatchJobData = {
        deliveryId: delivery.id,
        channel,
        tenantId: input.tenantId,
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        userId: input.userId,
      };

      await this.dispatchQueue.add(`${channel.toLowerCase()}-dispatch`, jobData, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: false, // keep exhausted jobs visible — dead-letter view in Bull Board
      });
    } catch (err: any) {
      this.logger.error(`Failed to enqueue ${channel} dispatch: ${err?.message}`);
    }
  }

  async listForTenant(tenantId: string, userId: string, isTenantAdmin = false, limit = 50) {
    const where = isTenantAdmin ? { tenantId } : { tenantId, OR: [{ userId: null }, { userId }] };

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { deliveries: true },
    });
  }

  async markRead(tenantId: string, notificationId: string, userId: string, isTenantAdmin = false) {
    const where = isTenantAdmin
      ? { id: notificationId, tenantId }
      : { id: notificationId, tenantId, OR: [{ userId: null }, { userId }] };

    return prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });
  }

  async deleteNotification(
    tenantId: string,
    notificationId: string,
    userId: string,
    isTenantAdmin = false,
  ) {
    const where = isTenantAdmin
      ? { id: notificationId, tenantId }
      : { id: notificationId, tenantId, OR: [{ userId: null }, { userId }] };

    const existing = await prisma.notification.findFirst({ where });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    // tenant-scope-ok: `existing` was just found via a tenantId-scoped findFirst above.
    await prisma.$transaction([
      prisma.notificationDelivery.deleteMany({ where: { notificationId } }),
      prisma.notification.delete({ where: { id: notificationId } }),
    ]);

    return { deleted: true, notificationId };
  }

  async listPreferences(tenantId: string, userId: string) {
    return prisma.notificationPreference.findMany({ where: { userId, tenantId } });
  }

  async setPreference(
    tenantId: string,
    userId: string,
    eventType: string,
    channel: NotificationChannel,
    isEnabled: boolean,
  ) {
    const existing = await prisma.notificationPreference.findFirst({
      where: { userId, eventType, channel, tenantId },
    });
    if (existing) {
      // tenant-scope-ok: `existing` was just found via a tenantId-scoped findFirst above.
      return prisma.notificationPreference.update({
        where: { id: existing.id },
        data: { isEnabled },
      });
    }
    return prisma.notificationPreference.create({
      data: { tenantId, userId, eventType, channel, isEnabled },
    });
  }

  private async resolveUserPhone(tenantId: string, userId: string): Promise<string | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = tenant?.settings as Record<string, unknown> | null;
    const phones = settings?.userPhones as Record<string, string> | undefined;
    return phones?.[userId] ?? process.env.SMS_DEFAULT_PHONE ?? null;
  }
}
