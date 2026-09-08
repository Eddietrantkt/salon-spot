import { NotificationType } from '@prisma/client';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';

const describeMySql = process.env.RUN_MYSQL_E2E === '1' ? describe : describe.skip;

describeMySql('Notification uniqueness on MySQL', () => {
  const prisma = new PrismaService();
  const suffix = `${Date.now()}`;
  const userId = `notify${suffix}`;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.create({
      data: {
        id: userId,
        email: `notification-${suffix}@example.test`,
        displayName: 'Notification Test User',
        passwordHash: '!integration-test-only!'
      }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('allows only one materialized notification for an event, recipient and type under concurrency', async () => {
    const data = {
      sourceEventId: `event${suffix}`,
      recipientUserId: userId,
      type: NotificationType.BOOKING_CONFIRMED,
      titleKey: 'notifications.bookingConfirmed.title',
      bodyKey: 'notifications.bookingConfirmed.body',
      payload: { bookingId: `booking${suffix}` },
      entityType: 'Booking',
      entityId: `booking${suffix}`
    };

    const results = await Promise.allSettled([
      prisma.notification.create({ data }),
      prisma.notification.create({ data })
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma.notification.count({ where: { recipientUserId: userId } })).resolves.toBe(1);
  });
});
