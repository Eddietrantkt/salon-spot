import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { MediaCleanupService } from '../../modules/media/application/media-cleanup.service.js';
import { WorkerHealthService } from './worker-health.service.js';
import { WorkerRuntimeHealthService, secondsFromEnv } from './worker-runtime-health.service.js';

@Injectable()
export class MediaCleanupWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaCleanupWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopping = false;
  private currentTick?: Promise<void>;

  constructor(private readonly cleanup: MediaCleanupService, private readonly health: WorkerHealthService, @Optional() private readonly runtime?: WorkerRuntimeHealthService) {}

  onModuleInit(): void {
    this.scheduleTick();
    this.timer = setInterval(() => this.scheduleTick(), secondsFromEnv('WORKER_TICK_INTERVAL_SECONDS', 5) * 1_000);
    this.logger.log('Media cleanup worker is registered.');
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
    this.runtime?.beginBatch('media-cleanup');
    const startedAt = Date.now();
    try {
      const recoveredCount = await this.cleanup.recoverStaleProcessing();
      const expiredUploadCount = await this.cleanup.expireStaleUploads();
      const processedCount = await this.cleanup.processBatch();
      await this.health.recordSuccess('media-cleanup');
      this.logger.log(JSON.stringify({ service: 'worker', worker: 'media-cleanup', event: 'batch_succeeded', recoveredCount, expiredUploadCount, processedCount, durationMs: Date.now() - startedAt }));
    } catch (error) {
      this.runtime?.recordFailure('media-cleanup');
      await this.health.recordFailure('media-cleanup', error).catch((heartbeatError: unknown) => this.logger.error('Unable to record worker heartbeat.', heartbeatError instanceof Error ? heartbeatError.stack : undefined));
      this.logger.error(JSON.stringify({ service: 'worker', worker: 'media-cleanup', event: 'batch_failed', durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      this.running = false;
      this.runtime?.endBatch('media-cleanup');
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
