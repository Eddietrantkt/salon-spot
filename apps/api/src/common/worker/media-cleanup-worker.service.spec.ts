import { MediaCleanupWorkerService } from './media-cleanup-worker.service.js';
import { MediaCleanupService } from '../../modules/media/application/media-cleanup.service.js';
import { WorkerHealthService } from './worker-health.service.js';

describe('MediaCleanupWorkerService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps the worker event loop alive for future cleanup batches', async () => {
    const unref = jest.fn();
    jest.spyOn(global, 'setInterval').mockReturnValue({ unref } as unknown as NodeJS.Timeout);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);
    const cleanup = {
      recoverStaleProcessing: jest.fn().mockResolvedValue(0),
      expireStaleUploads: jest.fn().mockResolvedValue(0),
      processBatch: jest.fn().mockResolvedValue(0)
    } as unknown as MediaCleanupService;

    const health = { recordSuccess: jest.fn().mockResolvedValue(undefined), recordFailure: jest.fn().mockResolvedValue(undefined) } as unknown as WorkerHealthService;
    const worker = new MediaCleanupWorkerService(cleanup, health);
    worker.onModuleInit();

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5_000);
    expect(unref).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });
});
