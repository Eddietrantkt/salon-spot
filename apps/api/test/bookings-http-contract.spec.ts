import { ForbiddenException, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import type { BookingSummary } from '@salon-spot/contracts';
import { API_PREFIX } from '@salon-spot/contracts';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { RequestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';
import { AccessTokenService } from '../src/modules/auth/application/access-token.service.js';
import { BookingsService } from '../src/modules/bookings/application/bookings.service.js';
import { BookingsController } from '../src/modules/bookings/presentation/bookings.controller.js';
import { ProfessionalAccessService } from '../src/modules/professionals/application/professional-access.service.js';
import { ProfessionalGuard } from '../src/modules/professionals/presentation/professional.guard.js';

const booking: BookingSummary = {
  id: 'booking_1',
  status: 'CONFIRMED',
  workspaceName: 'Chair One',
  rentalOptionLabel: '2 hours',
  priceCents: 250_000,
  startsAt: '2026-08-28T02:00:00.000Z',
  endsAt: '2026-08-28T04:00:00.000Z',
  salonTimezone: 'Asia/Ho_Chi_Minh',
  localDate: '2026-08-28',
  cancelledAt: null,
  completedAt: null
};
const bookings = {
  confirm: jest.fn(async () => ({ booking })),
  getMine: jest.fn(async () => ({ bookings: [booking] })),
  getMineById: jest.fn(async () => ({ booking, viewerCanCancel: true })),
  cancel: jest.fn(async () => ({ booking: { ...booking, status: 'CANCELLED' as const, cancelledAt: '2026-08-27T00:00:00.000Z' } }))
};
const professionalAccess = { assertActive: jest.fn().mockResolvedValue(undefined) };

@Module({
  controllers: [BookingsController],
  providers: [
    { provide: BookingsService, useValue: bookings },
    { provide: ProfessionalAccessService, useValue: professionalAccess },
    ProfessionalGuard,
    { provide: AccessTokenService, useValue: { verify: () => ({ sub: 'user_1', email: 'pro@example.test' }) } },
    { provide: PrismaService, useValue: { user: { findUnique: () => ({ id: 'user_1', email: 'pro@example.test', displayName: 'Professional', status: 'ACTIVE' }) } } },
    { provide: APP_FILTER, useClass: ApiExceptionFilter }
  ]
})
class BookingsHttpContractModule {}

describe('bookings HTTP contract', () => {
  let baseUrl: string;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  const authorization = { authorization: 'Bearer test-token' };

  beforeAll(async () => {
    app = await NestFactory.create(BookingsHttpContractModule, { logger: false });
    const requestIds = new RequestIdMiddleware();
    app.use(requestIds.use.bind(requestIds));
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/${API_PREFIX}`;
  });

  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    professionalAccess.assertActive.mockResolvedValue(undefined);
  });

  it('does not expose any booking endpoint without a valid bearer token', async () => {
    const response = await fetch(`${baseUrl}/me/bookings`, { headers: { 'x-request-id': 'booking-anonymous-1' } });
    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toBe('booking-anonymous-1');
    await expect(response.json()).resolves.toMatchObject({ requestId: 'booking-anonymous-1' });
    expect(bookings.getMine).not.toHaveBeenCalled();
  });

  it('requires an idempotency key before confirm and forwards its context to the lifecycle owner', async () => {
    const noKey = await fetch(`${baseUrl}/holds/hold_1/confirm`, { method: 'POST', headers: authorization });
    expect(noKey.status).toBe(400);
    expect(bookings.confirm).not.toHaveBeenCalled();

    const response = await fetch(`${baseUrl}/holds/hold_1/confirm`, {
      method: 'POST',
      headers: { ...authorization, 'idempotency-key': 'confirm-retry-1', 'x-request-id': 'request-confirm-1' }
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ booking });
    expect(bookings.confirm).toHaveBeenCalledWith('user_1', 'hold_1', 'confirm-retry-1', 'request-confirm-1');
  });

  it('denies a non-Professional caller before the booking lifecycle is invoked', async () => {
    professionalAccess.assertActive.mockRejectedValueOnce(
      new ForbiddenException({ code: 'FORBIDDEN', message: 'An active Professional profile is required to reserve or manage bookings.' })
    );

    const response = await fetch(`${baseUrl}/me/bookings`, { headers: authorization });
    expect(response.status).toBe(403);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ requestId: expect.any(String) });
    expect(bookings.getMine).not.toHaveBeenCalled();
  });

  it('links the personal booking list and detail endpoints to the authenticated caller', async () => {
    const list = await fetch(`${baseUrl}/me/bookings`, { headers: authorization });
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toEqual({ bookings: [booking] });
    expect(bookings.getMine).toHaveBeenCalledWith('user_1');

    const detail = await fetch(`${baseUrl}/me/bookings/booking_1`, { headers: authorization });
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toEqual({ booking, viewerCanCancel: true });
    expect(bookings.getMineById).toHaveBeenCalledWith('user_1', 'booking_1');
  });

  it('requires an idempotency key and delegates cancellation only through BookingsService', async () => {
    const response = await fetch(`${baseUrl}/bookings/booking_1/cancel`, {
      method: 'POST',
      headers: { ...authorization, 'idempotency-key': 'cancel-retry-1', 'x-request-id': 'request-cancel-1' }
    });

    expect(response.status).toBe(201);
    expect(bookings.cancel).toHaveBeenCalledWith('user_1', 'booking_1', 'cancel-retry-1', 'request-cancel-1');
  });
});
