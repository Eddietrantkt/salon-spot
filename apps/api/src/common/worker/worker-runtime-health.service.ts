import { Injectable } from '@nestjs/common';
import { WORKER_NAMES, type WorkerName } from './worker-names.js';

export interface WorkerJobRuntimeState {
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  running: boolean;
}

export interface WorkerRuntimeSnapshot {
  ready: boolean;
  startupGraceRemainingMs: number;
  staleJobs: WorkerName[];
  jobs: Record<WorkerName, WorkerJobRuntimeState>;
}

/**
 * Per-process state for readiness and watchdog decisions.  Database heartbeats
 * remain in WorkerHealthService for the Admin dashboard; this state answers
 * whether this exact worker process is currently making forward progress.
 */
@Injectable()
export class WorkerRuntimeHealthService {
  private readonly startedAt = new Date();
  private stopping = false;
  private readonly jobs = new Map<WorkerName, WorkerJobRuntimeState>(
    WORKER_NAMES.map((name) => [name, { lastSuccessAt: null, lastFailureAt: null, running: false }])
  );

  beginBatch(name: WorkerName): void {
    this.jobs.get(name)!.running = true;
  }

  recordSuccess(name: WorkerName, at = new Date()): void {
    const job = this.jobs.get(name)!;
    job.lastSuccessAt = at;
    job.running = false;
  }

  recordFailure(name: WorkerName, at = new Date()): void {
    const job = this.jobs.get(name)!;
    job.lastFailureAt = at;
    job.running = false;
  }

  endBatch(name: WorkerName): void {
    this.jobs.get(name)!.running = false;
  }

  beginShutdown(): void {
    this.stopping = true;
  }

  snapshot(now = new Date()): WorkerRuntimeSnapshot {
    const startupGraceMs = secondsFromEnv('WORKER_STARTUP_GRACE_SECONDS', 60) * 1_000;
    const staleAfterMs = secondsFromEnv('WORKER_STALE_AFTER_SECONDS', 30) * 1_000;
    const startupGraceRemainingMs = Math.max(0, this.startedAt.getTime() + startupGraceMs - now.getTime());
    const jobs = Object.fromEntries(WORKER_NAMES.map((name) => {
      const job = this.jobs.get(name)!;
      return [name, { ...job }];
    })) as Record<WorkerName, WorkerJobRuntimeState>;
    const staleJobs = startupGraceRemainingMs > 0 || this.stopping
      ? []
      : WORKER_NAMES.filter((name) => {
        const job = jobs[name];
        return !job.lastSuccessAt || now.getTime() - job.lastSuccessAt.getTime() > staleAfterMs;
      });
    const hasFailureAfterSuccess = WORKER_NAMES.some((name) => {
      const job = jobs[name];
      return Boolean(job.lastFailureAt && (!job.lastSuccessAt || job.lastFailureAt > job.lastSuccessAt));
    });
    return {
      ready: !this.stopping && startupGraceRemainingMs === 0 && staleJobs.length === 0 && !hasFailureAfterSuccess,
      startupGraceRemainingMs,
      staleJobs,
      jobs
    };
  }
}

export function secondsFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
