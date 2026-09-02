import { SlotHoldsService } from '../../modules/availability/application/slot-holds.service.js';
import { HoldExpiryWorkerService } from './hold-expiry-worker.service.js';
import { WorkerHealthService } from './worker-health.service.js';

describe('HoldExpiryWorkerService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('starts recurring expiry processing without overlapping a second synchronous tick', async () => {
    const unref = jest.fn();
    jest.spyOn(global, 'setInterval').mockReturnValue({ unref } as unknown as NodeJS.Timeout);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);
    const holds = { expireBatch: jest.fn().mockResolvedValue(0) } as unknown as SlotHoldsService;
    const health = { recordSuccess: jest.fn().mockResolvedValue(undefined), recordFailure: jest.fn().mockResolvedValue(undefined) } as unknown as WorkerHealthService;
    const worker = new HoldExpiryWorkerService(holds, health);

    worker.onModuleInit();
    await Promise.resolve();
    expect(holds.expireBatch).toHaveBeenCalledTimes(1);
    expect(health.recordSuccess).toHaveBeenCalledWith('hold-expiry');
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5_000);
    await worker.onModuleDestroy();
    expect(clearInterval).toHaveBeenCalled();
  });

  it('stops accepting future ticks while shutdown drains the current batch', async () => {
    let intervalCallback: (() => void) | undefined;
    jest.spyOn(global, 'setInterval').mockImplementation((callback) => {
      intervalCallback = callback as () => void;
      return {} as NodeJS.Timeout;
    });
    jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);
    const holds = { expireBatch: jest.fn().mockResolvedValue(0) } as unknown as SlotHoldsService;
    const health = { recordSuccess: jest.fn().mockResolvedValue(undefined), recordFailure: jest.fn().mockResolvedValue(undefined) } as unknown as WorkerHealthService;
    const worker = new HoldExpiryWorkerService(holds, health);

    worker.onModuleInit();
    await Promise.resolve();
    await worker.onModuleDestroy();
    intervalCallback?.();
    await Promise.resolve();

    expect(holds.expireBatch).toHaveBeenCalledTimes(1);
  });
});
