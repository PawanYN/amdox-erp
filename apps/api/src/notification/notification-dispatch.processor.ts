import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaClient, NotificationChannel, NotificationDeliveryStatus } from '@amdox/db';
import { WebhookChannel } from './channels/webhook.channel';
import { EmailChannel } from './channels/email.channel';
import { DispatchJobData } from './notification.service';

/**
 * Processes WEBHOOK/EMAIL dispatch jobs enqueued by NotificationService.notify().
 * Retries with exponential backoff (configured at enqueue time); a job that
 * exhausts its attempts is left in BullMQ's failed set (removeOnFail: false)
 * rather than being discarded, so it stays visible in the Bull Board dashboard
 * mounted at /admin/queues — the dead-letter view for this queue.
 */
@Processor('notification-dispatch')
export class NotificationDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDispatchProcessor.name);
  private prisma = new PrismaClient();

  constructor(
    private readonly webhookChannel: WebhookChannel,
    private readonly emailChannel: EmailChannel,
  ) {
    super();
  }

  async process(job: Job<DispatchJobData>): Promise<void> {
    const { deliveryId, channel, tenantId, eventType, title, body, userId } = job.data;

    try {
      const delivered =
        channel === NotificationChannel.WEBHOOK
          ? await this.dispatchWebhook(tenantId, eventType, title, body, userId)
          : await this.dispatchEmail(tenantId, userId, title, body);

      if (delivered === 'not-applicable') {
        // Whatever made this eligible at enqueue time (webhookUrl, user email) is
        // gone now — nothing to retry, and it's not a delivery failure either.
        await this.prisma.notificationDelivery.updateMany({
          where: { id: deliveryId, tenantId },
          data: { status: NotificationDeliveryStatus.FAILED, attempts: job.attemptsMade + 1 },
        });
        return;
      }

      if (!delivered) {
        throw new Error(`${channel} channel reported an unsuccessful dispatch`);
      }

      await this.prisma.notificationDelivery.updateMany({
        where: { id: deliveryId, tenantId },
        data: {
          status: NotificationDeliveryStatus.SENT,
          attempts: job.attemptsMade + 1,
          sentAt: new Date(),
        },
      });
    } catch (err: any) {
      const attemptsMade = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = attemptsMade >= maxAttempts;

      await this.prisma.notificationDelivery.updateMany({
        where: { id: deliveryId, tenantId },
        data: {
          status: isFinalAttempt
            ? NotificationDeliveryStatus.FAILED
            : NotificationDeliveryStatus.RETRYING,
          attempts: attemptsMade,
          lastError: String(err?.message ?? 'Unknown dispatch error').slice(0, 500),
        },
      });

      this.logger.warn(
        `${channel} dispatch attempt ${attemptsMade}/${maxAttempts} failed for delivery ${deliveryId}: ${err?.message}`,
      );
      throw err; // re-throw so BullMQ retries (or finalizes as failed on the last attempt)
    }
  }

  private async dispatchWebhook(
    tenantId: string,
    eventType: string,
    title: string,
    body: string | undefined,
    userId: string | undefined,
  ): Promise<boolean | 'not-applicable'> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = tenant?.settings as Record<string, unknown> | null;
    const webhookUrl = settings?.webhookUrl as string | undefined;
    if (!webhookUrl) return 'not-applicable';

    const signingSecret = (settings?.webhookSecret as string | undefined) ?? tenantId;
    return this.webhookChannel.dispatch(webhookUrl, signingSecret, {
      eventType,
      title,
      body,
      tenantId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  private async dispatchEmail(
    tenantId: string,
    userId: string | undefined,
    title: string,
    body: string | undefined,
  ): Promise<boolean | 'not-applicable'> {
    if (!userId) return 'not-applicable';
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { email: true },
    });
    if (!user?.email) return 'not-applicable';

    const result = await this.emailChannel.send({
      to: user.email,
      subject: title,
      body: body ?? title,
    });
    return result.delivered;
  }
}
