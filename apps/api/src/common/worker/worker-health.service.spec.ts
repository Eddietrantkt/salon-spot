import { PrismaService } from '../database/prisma/prisma.service.js';
import { WorkerHealthService } from './worker-health.service.js';

describe('WorkerHealthService', () => {
  it('records successful batches and clears an old error', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = { workerHeartbeat: { upsert } } as unknown as PrismaService;

    await new WorkerHealthService(prisma).recordSuccess('hold-expiry');

    expect(upsert).toHaveBeenCalledWith({
      where: { workerName: 'hold-expiry' },
      create: { workerName: 'hold-expiry', lastSucceededAt: expect.any(Date) },
      update: { lastSucceededAt: expect.any(Date), lastError: null }
    });
  });

  it('records a bounded error message when a batch fails', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = { workerHeartbeat: { upsert } } as unknown as PrismaService;

    await new WorkerHealthService(prisma).recordFailure('media-cleanup', new Error('storage unavailable'));

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workerName: 'media-cleanup' },
      create: expect.objectContaining({ lastError: 'storage unavailable' }),
      update: expect.objectContaining({ lastError: 'storage unavailable' })
    }));
  });
});
