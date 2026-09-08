import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { API_PREFIX } from '@salon-spot/contracts';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';
import { AccessTokenService } from '../src/modules/auth/application/access-token.service.js';

const describeMySql = process.env.RUN_MYSQL_E2E === '1' ? describe : describe.skip;

describeMySql('Notification inbox HTTP with persisted MySQL state', () => {
  const suffix = `${Date.now()}`;
  const users = [`nqa${suffix}`, `nqb${suffix}`];
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let prisma: PrismaService;
  let baseUrl: string;
  let token: string;
  let ownId: string;
  let foreignId: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/${API_PREFIX}`;
    prisma = app.get(PrismaService);
    await prisma.user.createMany({ data: users.map((id) => ({ id, email: `${id}@example.test`, displayName: id, passwordHash: 'fixture-only' })) });
    token = app.get(AccessTokenService).issue({ sub: users[0]!, email: `${users[0]}@example.test` }).token;
  }, 30_000);

  beforeEach(async () => {
    await prisma.idempotencyRecord.deleteMany({ where: { actorUserId: { in: users } } });
    await prisma.notification.deleteMany({ where: { recipientUserId: { in: users } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: users } } });
    const create = (recipientUserId: string, index: number) => prisma.notification.create({ data: {
      recipientUserId, sourceEventId: `qa-${suffix}-${index}`, type: 'BOOKING_CONFIRMED',
      titleKey: 'notifications.bookingConfirmed.title', bodyKey: 'notifications.bookingConfirmed.body',
      payload: { bookingId: 'fixture-booking' }, entityType: 'Booking', entityId: 'fixture-booking'
    } });
    ownId = (await create(users[0]!, 1)).id;
    await create(users[0]!, 2);
    foreignId = (await create(users[1]!, 3)).id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.idempotencyRecord.deleteMany({ where: { actorUserId: { in: users } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });

  function request(path: string, method = 'GET', body?: unknown, key?: string) {
    return fetch(`${baseUrl}/me/${path}`, { method, headers: {
      authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }

  it('requires real authentication and paginates only the recipient inbox', async () => {
    expect((await fetch(`${baseUrl}/me/notifications`)).status).toBe(401);
    const first = await request('notifications?page=1&pageSize=1');
    expect(first.status).toBe(200);
    const a = await first.json();
    const b = await (await request('notifications?page=2&pageSize=1')).json();
    expect(a.meta).toEqual({ page: 1, pageSize: 1, total: 2 });
    expect(a.data).toHaveLength(1);
    expect(b.data).toHaveLength(1);
    expect(a.data[0].id).not.toBe(b.data[0].id);
    expect([a.data[0].id, b.data[0].id]).not.toContain(foreignId);
    expect((await request('notifications?page=0')).status).toBe(400);
  });

  it('rejects cross-user reads and missing keys without modifying the DB', async () => {
    expect((await request(`notifications/${foreignId}/read`, 'PUT', {}, 'foreign')).status).toBe(404);
    expect((await request(`notifications/${ownId}/read`, 'PUT', {})).status).toBe(400);
    expect(await prisma.notification.count({ where: { recipientUserId: { in: users }, readAt: { not: null } } })).toBe(0);
  });

  it('persists mark-read, replays idempotently and keeps read/unread filters consistent', async () => {
    const first = await request(`notifications/${ownId}/read`, 'PUT', {}, 'read');
    expect(first.status).toBe(200);
    const saved = await first.json();
    expect(saved.readAt).toEqual(expect.any(String));
    expect(await (await request(`notifications/${ownId}/read`, 'PUT', {}, 'read')).json()).toEqual(saved);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: ownId } })).readAt?.toISOString()).toBe(saved.readAt);
    expect(await (await request('notifications/unread-count')).json()).toEqual({ unreadCount: 1 });
    expect((await (await request('notifications?status=read')).json()).data.map((item: { id: string }) => item.id)).toEqual([ownId]);
    expect((await (await request('notifications?status=unread')).json()).meta.total).toBe(1);
  });

  it('marks all own items read without touching another recipient', async () => {
    const result = await request('notifications/read-all', 'PUT', {}, 'all');
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ updatedCount: 2, unreadCount: 0 });
    expect(await prisma.notification.count({ where: { recipientUserId: users[0], readAt: null } })).toBe(0);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: foreignId } })).readAt).toBeNull();
  });

  it('persists preferences, rejects invalid input and prevents idempotency key reuse with a different payload', async () => {
    expect(await (await request('notification-preferences')).json()).toMatchObject({ locale: 'EN', transactionalInAppEnabled: true });
    const input = { locale: 'VI', emailEnabled: false, marketingEnabled: true };
    expect((await request('notification-preferences', 'PATCH', input, 'prefs')).status).toBe(200);
    expect(await (await request('notification-preferences')).json()).toEqual({ ...input, transactionalInAppEnabled: true });
    expect(await prisma.notificationPreference.findUnique({ where: { userId: users[0] } })).toMatchObject(input);
    expect((await request('notification-preferences', 'PATCH', { locale: 'EN' }, 'prefs')).status).toBe(409);
    for (const invalid of [{ locale: 'XX' }, { emailEnabled: 'yes' }, { transactionalInAppEnabled: false }]) {
      expect((await request('notification-preferences', 'PATCH', invalid, 'invalid')).status).toBe(400);
    }
  });
});
