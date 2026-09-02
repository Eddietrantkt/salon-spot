import { OutboxStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { BookingNotificationOutboxService } from './booking-notification-outbox.service.js';

describe('BookingNotificationOutboxService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('claims a pending booking event once and marks it delivered through the log sink', async () => {
    const event = { id: 'event_1', topic: 'BOOKING_CONFIRMED', status: OutboxStatus.PENDING, attempts: 0, availableAt: new Date(), createdAt: new Date(), payload: { bookingId: 'booking_1' } };
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 })
      }
    } as unknown as PrismaService;
    const service = new BookingNotificationOutboxService(prisma);
    jest.spyOn((service as unknown as { logger: { log: (value: string) => void } }).logger, 'log').mockImplementation(() => undefined);

    await expect(service.processBatch()).resolves.toBe(1);
    expect(prisma.outboxEvent.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ status: OutboxStatus.PROCESSING }) }));
    expect(prisma.outboxEvent.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { status: OutboxStatus.DELIVERED } }));
  });

  it('does not redeliver an event when another worker already owns its lease', async () => {
    const event = { id: 'event_1', topic: 'BOOKING_CANCELLED', status: OutboxStatus.PENDING, attempts: 0, availableAt: new Date(), createdAt: new Date(), payload: { bookingId: 'booking_1' } };
    const prisma = {
      outboxEvent: { findMany: jest.fn().mockResolvedValue([event]), updateMany: jest.fn().mockResolvedValue({ count: 0 }) }
    } as unknown as PrismaService;

    await expect(new BookingNotificationOutboxService(prisma).processBatch()).resolves.toBe(0);
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledTimes(1);
  });
});
