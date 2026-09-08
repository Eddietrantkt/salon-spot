import { NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

const notification = {
  id: 'notification_1',
  type: NotificationType.BOOKING_CONFIRMED,
  titleKey: 'notifications.bookingConfirmed.title',
  bodyKey: 'notifications.bookingConfirmed.body',
  payload: { bookingId: 'booking_1' },
  entityType: 'Booking',
  entityId: 'booking_1',
  readAt: null,
  createdAt: new Date('2026-09-08T01:00:00.000Z'),
  expiresAt: null
};

describe('NotificationsService', () => {
  it('lists only the current user notifications with a server-side unread filter', async () => {
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([notification]),
        count: jest.fn().mockResolvedValue(1)
      },
      $transaction: jest.fn((queries: unknown[]) => Promise.all(queries))
    } as unknown as PrismaService;

    const response = await new NotificationsService(prisma).listMine('user_1', { status: 'unread', page: 2, pageSize: 10 });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { recipientUserId: 'user_1', readAt: null },
      skip: 10,
      take: 10
    }));
    expect(response).toEqual({
      data: [expect.objectContaining({ id: 'notification_1', createdAt: '2026-09-08T01:00:00.000Z' })],
      meta: { page: 2, pageSize: 10, total: 1 }
    });
  });

  it('does not reveal or mutate a notification owned by another user', async () => {
    const tx = { notification: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() }, idempotencyRecord: { findUnique: jest.fn(), create: jest.fn() } };
    const prisma = {
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx))
    } as unknown as PrismaService;

    await expect(new NotificationsService(prisma).markRead('user_2', 'notification_1', 'read-key')).rejects.toThrow(NotFoundException);
    expect(tx.notification.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'notification_1', recipientUserId: 'user_2' } }));
    expect(tx.notification.update).not.toHaveBeenCalled();
  });
});
