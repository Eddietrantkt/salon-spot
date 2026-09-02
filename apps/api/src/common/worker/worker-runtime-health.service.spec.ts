import { WorkerRuntimeHealthService } from './worker-runtime-health.service.js';
import { WorkerWatchdogService, type WorkerExit } from './worker-watchdog.service.js';

describe('WorkerRuntimeHealthService', () => {
  const originalStale = process.env.WORKER_STALE_AFTER_SECONDS;
  const originalGrace = process.env.WORKER_STARTUP_GRACE_SECONDS;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-02T00:00:00.000Z'));
    process.env.WORKER_STARTUP_GRACE_SECONDS = '10';
    process.env.WORKER_STALE_AFTER_SECONDS = '30';
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalStale === undefined) delete process.env.WORKER_STALE_AFTER_SECONDS;
    else process.env.WORKER_STALE_AFTER_SECONDS = originalStale;
    if (originalGrace === undefined) delete process.env.WORKER_STARTUP_GRACE_SECONDS;
    else process.env.WORKER_STARTUP_GRACE_SECONDS = originalGrace;
  });

  it('does not report ready until every batch has completed successfully after startup grace', () => {
    const health = new WorkerRuntimeHealthService();
    jest.advanceTimersByTime(10_000);
    expect(health.snapshot().ready).toBe(false);
    health.recordSuccess('hold-expiry');
    health.recordSuccess('booking-lifecycle');
    health.recordSuccess('media-cleanup');
    expect(health.snapshot().ready).toBe(true);
  });

  it('marks a job stale when its latest successful batch is too old', () => {
    const health = new WorkerRuntimeHealthService();
    health.recordSuccess('hold-expiry');
    health.recordSuccess('booking-lifecycle');
    health.recordSuccess('media-cleanup');
    jest.advanceTimersByTime(31_000);
    expect(health.snapshot().staleJobs).toEqual(['hold-expiry', 'booking-lifecycle', 'media-cleanup']);
  });

  it('causes one non-zero termination request for stale work', () => {
    const health = new WorkerRuntimeHealthService();
    const exit = jest.fn() as unknown as WorkerExit;
    const watchdog = new WorkerWatchdogService(health, exit);
    jest.advanceTimersByTime(10_000);
    watchdog.check();
    watchdog.check();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
