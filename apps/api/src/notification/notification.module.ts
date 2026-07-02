import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEventListener } from './notification-event.listener';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventListener],
  exports: [NotificationService],
})
export class NotificationModule {}
