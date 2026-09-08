import { NotificationOutboxProcessor } from '../../modules/notifications/application/notification-outbox.processor.js';
import { NotificationWorkerService } from './notification-worker.service.js';
import { WorkerHealthService } from './worker-health.service.js';

describe('NotificationWorkerService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('processes post-commit notifications and records its own heartbeat', async () => {
    jest.spyOn(global, 'setInterval').mockReturnValue({} as NodeJS.Timeout);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);
    const notifications = { processBatch: jest.fn().mockResolvedValue(2) } as unknown as NotificationOutboxProcessor;
    const health = { recordSuccess: jest.fn().mockResolvedValue(undefined), recordFailure: jest.fn().mockResolvedValue(undefined) } as unknown as WorkerHealthService;
    const worker = new NotificationWorkerService(notifications, health);

    worker.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(notifications.processBatch).toHaveBeenCalledTimes(1);
    expect(health.recordSuccess).toHaveBeenCalledWith('notification-delivery');
    await worker.onModuleDestroy();
  });
});
