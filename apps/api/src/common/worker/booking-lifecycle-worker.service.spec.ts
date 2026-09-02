import { BookingNotificationOutboxService } from '../../modules/bookings/application/booking-notification-outbox.service.js';
import { BookingsService } from '../../modules/bookings/application/bookings.service.js';
import { BookingLifecycleWorkerService } from './booking-lifecycle-worker.service.js';
import { WorkerHealthService } from './worker-health.service.js';

describe('BookingLifecycleWorkerService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('runs completion before notification delivery and keeps a future interval alive', async () => {
    const unref = jest.fn();
    jest.spyOn(global, 'setInterval').mockReturnValue({ unref } as unknown as NodeJS.Timeout);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);
    const order: string[] = [];
    const bookings = { completeEndedBookings: jest.fn(async () => { order.push('complete'); return 0; }) } as unknown as BookingsService;
    const notifications = { processBatch: jest.fn(async () => { order.push('notify'); return 0; }) } as unknown as BookingNotificationOutboxService;
    const health = { recordSuccess: jest.fn().mockResolvedValue(undefined), recordFailure: jest.fn().mockResolvedValue(undefined) } as unknown as WorkerHealthService;
    const worker = new BookingLifecycleWorkerService(bookings, notifications, health);

    worker.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5_000);
    expect(unref).not.toHaveBeenCalled();
    expect(order).toEqual(['complete', 'notify']);
    expect(health.recordSuccess).toHaveBeenCalledWith('booking-lifecycle');
    await worker.onModuleDestroy();
  });
});
