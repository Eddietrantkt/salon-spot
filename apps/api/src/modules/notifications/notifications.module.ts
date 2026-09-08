import { Module } from '@nestjs/common';
import { NotificationOutboxProcessor } from './application/notification-outbox.processor.js';
import { NotificationsService } from './application/notifications.service.js';
import { NotificationsController } from './presentation/notifications.controller.js';

/** Owns user inbox state and post-commit delivery materialization. */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationOutboxProcessor],
  exports: [NotificationOutboxProcessor]
})
export class NotificationsModule {}
