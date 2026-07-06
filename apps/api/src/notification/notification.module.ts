import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEventListener } from './notification-event.listener';
import { WebhookChannel } from './channels/webhook.channel';
import { EmailChannel } from './channels/email.channel';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventListener, WebhookChannel, EmailChannel],
  exports: [NotificationService],
})
export class NotificationModule {}
