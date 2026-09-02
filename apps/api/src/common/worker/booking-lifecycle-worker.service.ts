import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { BookingNotificationOutboxService } from '../../modules/bookings/application/booking-notification-outbox.service.js';
import { BookingsService } from '../../modules/bookings/application/bookings.service.js';
import { WorkerHealthService } from './worker-health.service.js';
import { WorkerRuntimeHealthService, secondsFromEnv } from './worker-runtime-health.service.js';

@Injectable()
export class BookingLifecycleWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingLifecycleWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopping = false;
  private currentTick?: Promise<void>;

  constructor(private readonly bookings: BookingsService, private readonly notifications: BookingNotificationOutboxService, private readonly health: WorkerHealthService, @Optional() private readonly runtime?: WorkerRuntimeHealthService) {}

  onModuleInit(): void {
    this.scheduleTick();
    this.timer = setInterval(() => this.scheduleTick(), secondsFromEnv('WORKER_TICK_INTERVAL_SECONDS', 5) * 1_000);
    this.logger.log('Booking lifecycle worker is registered.');
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.waitForCurrentTick();
  }

  private scheduleTick(): void {
    if (this.stopping || this.running) return;
    this.currentTick = this.tick();
    void this.currentTick.finally(() => { this.currentTick = undefined; });
  }

  private async tick(): Promise<void> {
    if (this.stopping || this.running) return;
    this.running = true;
    this.runtime?.beginBatch('booking-lifecycle');
    const startedAt = Date.now();
    try {
      const completedCount = await this.bookings.completeEndedBookings();
      const deliveredCount = await this.notifications.processBatch();
      await this.health.recordSuccess('booking-lifecycle');
      this.logger.log(JSON.stringify({ service: 'worker', worker: 'booking-lifecycle', event: 'batch_succeeded', completedCount, deliveredCount, durationMs: Date.now() - startedAt }));
    } catch (error) {
      this.runtime?.recordFailure('booking-lifecycle');
      await this.health.recordFailure('booking-lifecycle', error).catch((heartbeatError: unknown) => this.logger.error('Unable to record worker heartbeat.', heartbeatError instanceof Error ? heartbeatError.stack : undefined));
      this.logger.error(JSON.stringify({ service: 'worker', worker: 'booking-lifecycle', event: 'batch_failed', durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      this.running = false;
      this.runtime?.endBatch('booking-lifecycle');
    }
  }

  private async waitForCurrentTick(): Promise<void> {
    if (!this.currentTick) return;
    const graceMs = secondsFromEnv('WORKER_SHUTDOWN_GRACE_SECONDS', 20) * 1_000;
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([this.currentTick, new Promise<void>((resolve) => { timeout = setTimeout(resolve, graceMs); })]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
