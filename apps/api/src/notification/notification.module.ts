import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEventListener } from './notification-event.listener';
import { NotificationDispatchProcessor } from './notification-dispatch.processor';
import { WebhookChannel } from './channels/webhook.channel';
import { EmailChannel } from './channels/email.channel';

@Module({
  imports: [BullModule.registerQueue({ name: 'notification-dispatch' })],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationEventListener,
    NotificationDispatchProcessor,
    WebhookChannel,
    EmailChannel,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
