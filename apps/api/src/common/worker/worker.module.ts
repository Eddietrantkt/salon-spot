import { DynamicModule, Module } from '@nestjs/common';
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

export interface WorkerModuleOptions {
  /** Start scheduled jobs in this Nest application process. */
  runJobs: boolean;
  /** Expose the worker readiness endpoint in this process. */
  exposeHealth?: boolean;
}

const workerImports = [AppConfigModule, PrismaModule, AuthModule, AvailabilityModule, BookingsModule, MediaModule, NotificationsModule];
const workerProviders = [
  WorkerRuntimeHealthService,
  WorkerHealthService,
  WorkerLifecycleService,
  WorkerWatchdogService,
  { provide: WORKER_EXIT, useValue: process.exit.bind(process) },
  HoldExpiryWorkerService,
  BookingLifecycleWorkerService,
  NotificationWorkerService,
  MediaCleanupWorkerService
];

/**
 * Worker foundation for outbox delivery, expiry and provider retries.
 *
 * The normal runtime uses a separate process. The Render POC can opt into
 * running the same jobs inside the API process because its free plan has no
 * background-worker service.
 */
@Module({})
export class WorkerModule {
  static register(options: WorkerModuleOptions): DynamicModule {
    return {
      module: WorkerModule,
      imports: options.runJobs ? workerImports : [],
      controllers: options.exposeHealth && options.runJobs ? [WorkerHealthController] : [],
      providers: options.runJobs ? workerProviders : []
    };
  }
}
