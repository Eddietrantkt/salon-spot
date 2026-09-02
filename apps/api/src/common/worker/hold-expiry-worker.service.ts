import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { SlotHoldsService } from '../../modules/availability/application/slot-holds.service.js';
import { WorkerHealthService } from './worker-health.service.js';
import { WorkerRuntimeHealthService, secondsFromEnv } from './worker-runtime-health.service.js';

@Injectable()
export class HoldExpiryWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpiryWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopping = false;
  private currentTick?: Promise<void>;

  constructor(private readonly holds: SlotHoldsService, private readonly health: WorkerHealthService, @Optional() private readonly runtime?: WorkerRuntimeHealthService) {}

  onModuleInit(): void {
    this.scheduleTick();
    this.timer = setInterval(() => this.scheduleTick(), secondsFromEnv('WORKER_TICK_INTERVAL_SECONDS', 5) * 1_000);
    this.logger.log('Slot hold expiry worker is registered.');
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
    this.runtime?.beginBatch('hold-expiry');
    const startedAt = Date.now();
    try {
      const count = await this.holds.expireBatch();
      await this.health.recordSuccess('hold-expiry');
      this.logger.log(JSON.stringify({ service: 'worker', worker: 'hold-expiry', event: 'batch_succeeded', count, durationMs: Date.now() - startedAt }));
    } catch (error) {
      this.runtime?.recordFailure('hold-expiry');
      await this.health.recordFailure('hold-expiry', error).catch((heartbeatError: unknown) => this.logger.error('Unable to record worker heartbeat.', heartbeatError instanceof Error ? heartbeatError.stack : undefined));
      this.logger.error(JSON.stringify({ service: 'worker', worker: 'hold-expiry', event: 'batch_failed', durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      this.running = false;
      this.runtime?.endBatch('hold-expiry');
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
