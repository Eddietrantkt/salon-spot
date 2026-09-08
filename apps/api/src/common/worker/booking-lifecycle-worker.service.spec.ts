import { BookingsService } from '../../modules/bookings/application/bookings.service.js';
import { BookingLifecycleWorkerService } from './booking-lifecycle-worker.service.js';
import { WorkerHealthService } from './worker-health.service.js';

describe('BookingLifecycleWorkerService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('runs booking completion and keeps a future interval alive', async () => {
    const unref = jest.fn();
    jest.spyOn(global, 'setInterval').mockReturnValue({ unref } as unknown as NodeJS.Timeout);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);
    const bookings = { completeEndedBookings: jest.fn(async () => 0) } as unknown as BookingsService;
    const health = { recordSuccess: jest.fn().mockResolvedValue(undefined), recordFailure: jest.fn().mockResolvedValue(undefined) } as unknown as WorkerHealthService;
    const worker = new BookingLifecycleWorkerService(bookings, health);

    worker.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5_000);
    expect(unref).not.toHaveBeenCalled();
    expect(bookings.completeEndedBookings).toHaveBeenCalledTimes(1);
    expect(health.recordSuccess).toHaveBeenCalledWith('booking-lifecycle');
    await worker.onModuleDestroy();
  });
});
