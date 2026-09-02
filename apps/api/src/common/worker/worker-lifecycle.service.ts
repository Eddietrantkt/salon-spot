import { BeforeApplicationShutdown, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WorkerRuntimeHealthService } from './worker-runtime-health.service.js';

@Injectable()
export class WorkerLifecycleService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(WorkerLifecycleService.name);

  constructor(private readonly runtime: WorkerRuntimeHealthService) {}

  onModuleInit(): void {
    this.logger.log('Worker foundation is ready.');
  }

  beforeApplicationShutdown(signal?: string): void {
    this.runtime.beginShutdown();
    this.logger.log(JSON.stringify({ service: 'worker', event: 'shutdown_started', signal: signal ?? 'application_close' }));
  }
}
