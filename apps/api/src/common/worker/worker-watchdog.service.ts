import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WorkerRuntimeHealthService, secondsFromEnv } from './worker-runtime-health.service.js';

export const WORKER_EXIT = Symbol('WORKER_EXIT');
export type WorkerExit = (code: number) => never;

/** Exits only for loss of forward progress; Docker Compose owns process restart. */
@Injectable()
export class WorkerWatchdogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerWatchdogService.name);
  private timer?: NodeJS.Timeout;
  private restartRequested = false;

  constructor(
    private readonly runtime: WorkerRuntimeHealthService,
    @Inject(WORKER_EXIT) private readonly exit: WorkerExit
  ) {}

  onModuleInit(): void {
    const intervalMs = secondsFromEnv('WORKER_WATCHDOG_INTERVAL_SECONDS', 5) * 1_000;
    this.timer = setInterval(() => this.check(), intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  check(now = new Date()): void {
    if (this.restartRequested) return;
    const snapshot = this.runtime.snapshot(now);
    if (snapshot.staleJobs.length === 0) return;
    this.restartRequested = true;
    this.logger.error(JSON.stringify({
      service: 'worker',
      event: 'watchdog_stale_exit',
      staleJobs: snapshot.staleJobs,
      staleAfterSeconds: secondsFromEnv('WORKER_STALE_AFTER_SECONDS', 30),
      restartCause: 'no_successful_batch_within_threshold'
    }));
    this.exit(1);
  }
}
