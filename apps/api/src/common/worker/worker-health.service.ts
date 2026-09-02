import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service.js';
import { WorkerRuntimeHealthService } from './worker-runtime-health.service.js';
import type { WorkerName } from './worker-names.js';

export { WORKER_NAMES, type WorkerName } from './worker-names.js';

/** Persists worker liveness independently from the jobs' business transactions. */
@Injectable()
export class WorkerHealthService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly runtime?: WorkerRuntimeHealthService) {}

  async recordSuccess(workerName: WorkerName): Promise<void> {
    const now = new Date();
    await this.prisma.workerHeartbeat.upsert({
      where: { workerName },
      create: { workerName, lastSucceededAt: now },
      update: { lastSucceededAt: now, lastError: null }
    });
    this.runtime?.recordSuccess(workerName, now);
  }

  async recordFailure(workerName: WorkerName, error: unknown): Promise<void> {
    const now = new Date();
    const message = error instanceof Error ? error.message : 'Unknown worker error';
    await this.prisma.workerHeartbeat.upsert({
      where: { workerName },
      create: { workerName, lastFailedAt: now, lastError: message.slice(0, 500) },
      update: { lastFailedAt: now, lastError: message.slice(0, 500) }
    });
    this.runtime?.recordFailure(workerName, now);
  }
}
