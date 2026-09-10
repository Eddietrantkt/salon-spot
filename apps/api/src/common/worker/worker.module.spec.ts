import { WorkerModule } from './worker.module.js';

describe('WorkerModule', () => {
  it('does not register scheduled jobs unless explicitly enabled', () => {
    const module = WorkerModule.register({ runJobs: false, exposeHealth: false });

    expect(module.controllers).toEqual([]);
    expect(module.providers).toEqual([]);
    expect(module.imports).toEqual([]);
  });

  it('registers the jobs and readiness endpoint for a co-located runtime', () => {
    const module = WorkerModule.register({ runJobs: true, exposeHealth: true });

    expect(module.controllers).toHaveLength(1);
    expect(module.providers).toHaveLength(9);
    expect(module.imports).toHaveLength(7);
  });
});
