import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { PrismaModule } from '../database/prisma/prisma.module.js';
import { AuthModule } from '../../modules/auth/auth.module.js';
import { AvailabilityModule } from '../../modules/availability/availability.module.js';
import { BookingsModule } from '../../modules/bookings/bookings.module.js';
import { MediaModule } from '../../modules/media/media.module.js';
import { NotificationsModule } from '../../modules/notifications/notifications.module.js';
import { MediaCleanupWorkerService } from './media-cleanup-worker.service.js';
import { WorkerLifecycleService } from './worker-lifecycle.service.js';
import { HoldExpiryWorkerService } from './hold-expiry-worker.service.js';
import { BookingLifecycleWorkerService } from './booking-lifecycle-worker.service.js';
import { WorkerHealthService } from './worker-health.service.js';
import { WorkerRuntimeHealthService } from './worker-runtime-health.service.js';
import { WorkerHealthController } from './worker-health.controller.js';
import { WorkerWatchdogService, WORKER_EXIT } from './worker-watchdog.service.js';
import { NotificationWorkerService } from './notification-worker.service.js';

/**
 * Separate process foundation for outbox delivery, expiry and provider retries.
 * Jobs are intentionally added only with their owning feature module.
 */
@Module({
  imports: [AppConfigModule, PrismaModule, AuthModule, AvailabilityModule, BookingsModule, MediaModule, NotificationsModule],
  controllers: [WorkerHealthController],
  providers: [
    WorkerRuntimeHealthService,
    WorkerHealthService,
    WorkerLifecycleService,
    WorkerWatchdogService,
    { provide: WORKER_EXIT, useValue: process.exit.bind(process) },
    HoldExpiryWorkerService,
    BookingLifecycleWorkerService,
    NotificationWorkerService,
    MediaCleanupWorkerService
  ]
})
export class WorkerModule {}
