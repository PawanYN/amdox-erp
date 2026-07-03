import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEventListener } from './notification-event.listener';
import { WebhookChannel } from './channels/webhook.channel';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventListener, WebhookChannel],
  exports: [NotificationService],
})
export class NotificationModule {}
