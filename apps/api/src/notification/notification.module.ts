import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEventListener } from './notification-event.listener';
import { NotificationDispatchProcessor } from './notification-dispatch.processor';
import { WebhookChannel } from './channels/webhook.channel';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { QUEUE_NAMES } from '../infrastructure/queues/queue-names';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATION_DISPATCH })],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationEventListener,
    NotificationDispatchProcessor,
    WebhookChannel,
    EmailChannel,
    SmsChannel,
  ],
  exports: [NotificationService, EmailChannel],
})
export class NotificationModule {}
