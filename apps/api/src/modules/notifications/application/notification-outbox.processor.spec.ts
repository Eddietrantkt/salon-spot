import { NotificationChannel, NotificationDeliveryStatus, NotificationType, OutboxStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { NotificationOutboxProcessor } from './notification-outbox.processor.js';

describe('NotificationOutboxProcessor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('materializes one inbox item per active booking participant and completes the lease atomically', async () => {
    const event = {
      id: 'event_1',
      topic: 'BOOKING_CONFIRMED',
      payload: { bookingId: 'booking_1' },
      status: OutboxStatus.PENDING,
      attempts: 0,
      availableAt: new Date('2026-09-08T00:00:00.000Z'),
      createdAt: new Date('2026-09-08T00:00:00.000Z')
    };
    const notificationUpsert = jest.fn()
      .mockResolvedValueOnce({ id: 'notification_professional' })
      .mockResolvedValueOnce({ id: 'notification_owner' });
    const deliveryUpsert = jest.fn().mockResolvedValue({});
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking_1',
          workspaceName: 'Chair One',
          startsAt: new Date('2026-09-10T02:00:00.000Z'),
          salonTimezone: 'Asia/Ho_Chi_Minh',
          localDate: new Date('2026-09-10T00:00:00.000Z'),
          professionalUserId: 'professional_1',
          professional: { status: 'ACTIVE' },
          slot: { workspace: { salon: { memberships: [{ userId: 'owner_1' }] } } }
        })
      },
      notification: { upsert: notificationUpsert },
      notificationDelivery: { upsert: deliveryUpsert },
      outboxEvent: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }
    };
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([event]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;
    const processor = new NotificationOutboxProcessor(prisma);
    jest.spyOn((processor as unknown as { logger: { error: (value: string) => void } }).logger, 'error').mockImplementation(() => undefined);

    await expect(processor.processBatch()).resolves.toBe(1);

    expect(notificationUpsert).toHaveBeenCalledTimes(2);
    expect(notificationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { sourceEventId_recipientUserId_type: { sourceEventId: 'event_1', recipientUserId: 'professional_1', type: NotificationType.BOOKING_CONFIRMED } },
      create: expect.objectContaining({ payload: expect.objectContaining({ recipientRole: 'PROFESSIONAL' }) })
    }));
    expect(deliveryUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ channel: NotificationChannel.IN_APP, status: NotificationDeliveryStatus.DELIVERED })
    }));
    expect(tx.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: OutboxStatus.DELIVERED } }));
  });

  it('releases a malformed event to bounded retry without creating an inbox item', async () => {
    const event = {
      id: 'event_bad',
      topic: 'BOOKING_CANCELLED',
      payload: {},
      status: OutboxStatus.PENDING,
      attempts: 0,
      availableAt: new Date(),
      createdAt: new Date()
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      outboxEvent: { findMany: jest.fn().mockResolvedValue([event]), updateMany },
      $transaction: jest.fn()
    } as unknown as PrismaService;
    const processor = new NotificationOutboxProcessor(prisma);
    jest.spyOn((processor as unknown as { logger: { error: (value: string) => void } }).logger, 'error').mockImplementation(() => undefined);

    await expect(processor.processBatch()).resolves.toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ status: OutboxStatus.FAILED }) }));
  });
});
