import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { API_PREFIX, type AuthenticatedUser, type NotificationItem } from '@salon-spot/contracts';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { RequestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { AccessTokenGuard } from '../src/modules/auth/presentation/access-token.guard.js';
import { NotificationsService } from '../src/modules/notifications/application/notifications.service.js';
import { NotificationsController } from '../src/modules/notifications/presentation/notifications.controller.js';

const user: AuthenticatedUser = { id: 'user_1', email: 'member@example.com', displayName: 'Member' };
const notification: NotificationItem = {
  id: 'notification_1',
  type: 'BOOKING_CONFIRMED',
  titleKey: 'notifications.bookingConfirmed.title',
  bodyKey: 'notifications.bookingConfirmed.body',
  payload: { bookingId: 'booking_1' },
  entityType: 'Booking',
  entityId: 'booking_1',
  readAt: null,
  createdAt: '2026-09-08T01:00:00.000Z',
  expiresAt: null
};
const notifications = {
  listMine: jest.fn().mockResolvedValue({ data: [notification], meta: { page: 1, pageSize: 20, total: 1 } }),
  unreadCount: jest.fn().mockResolvedValue({ unreadCount: 1 }),
  markRead: jest.fn().mockResolvedValue({ ...notification, readAt: '2026-09-08T02:00:00.000Z' }),
  markAllRead: jest.fn().mockResolvedValue({ updatedCount: 1, unreadCount: 0 }),
  getPreferences: jest.fn().mockResolvedValue({ locale: 'EN', emailEnabled: true, marketingEnabled: false, transactionalInAppEnabled: true }),
  updatePreferences: jest.fn()
};

describe('Notifications HTTP contracts', () => {
  let baseUrl: string;
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notifications },
        { provide: APP_FILTER, useClass: ApiExceptionFilter }
      ]
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: AuthenticatedUser } } }) => {
          context.switchToHttp().getRequest().user = user;
          return true;
        }
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    const requestIds = new RequestIdMiddleware();
    app.use(requestIds.use.bind(requestIds));
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/${API_PREFIX}`;
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('returns the authenticated user inbox and validates its query contract', async () => {
    const response = await fetch(`${baseUrl}/me/notifications?status=unread&page=1&pageSize=20`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: [{ id: 'notification_1' }], meta: { total: 1 } });
    expect(notifications.listMine).toHaveBeenCalledWith('user_1', { status: 'unread', page: 1, pageSize: 20 });

    const invalid = await fetch(`${baseUrl}/me/notifications?status=archived`);
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR', requestId: expect.any(String) });
  });

  it('requires an idempotency key for notification mutations', async () => {
    const missingKey = await fetch(`${baseUrl}/me/notifications/notification_1/read`, { method: 'PUT' });
    expect(missingKey.status).toBe(400);
    expect(notifications.markRead).not.toHaveBeenCalled();

    const response = await fetch(`${baseUrl}/me/notifications/notification_1/read`, {
      method: 'PUT',
      headers: { 'idempotency-key': 'read-once' }
    });
    expect(response.status).toBe(200);
    expect(notifications.markRead).toHaveBeenCalledWith('user_1', 'notification_1', 'read-once');
  });
});
