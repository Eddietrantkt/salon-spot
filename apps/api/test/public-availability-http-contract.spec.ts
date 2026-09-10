import { ForbiddenException, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { API_PREFIX, type CreateSlotHoldResponse, type MyHoldsResponse, type WorkspaceDetailResponse } from '@salon-spot/contracts';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { RequestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';
import { PublicWorkspaceDetailService } from '../src/modules/availability/application/public-workspace-detail.service.js';
import { SlotHoldsService } from '../src/modules/availability/application/slot-holds.service.js';
import { AccessTokenGuard } from '../src/modules/auth/presentation/access-token.guard.js';
import { AccessTokenService } from '../src/modules/auth/application/access-token.service.js';
import { PublicAvailabilityController } from '../src/modules/availability/presentation/public-availability.controller.js';
import { ProfessionalAccessService } from '../src/modules/professionals/application/professional-access.service.js';
import { ProfessionalGuard } from '../src/modules/professionals/presentation/professional.guard.js';

const detail: WorkspaceDetailResponse = { workspaceId: 'workspace_1', salonId: 'salon_1', workspaceName: 'Chair One', salonName: 'Salon One', area: 'D1', timezone: 'Asia/Ho_Chi_Minh', media: [], slots: [] };
const workspaceDetails = { get: jest.fn(async () => detail) };
const createdHold: CreateSlotHoldResponse = {
  hold: {
    id: 'hold_1',
    slotId: 'slot_1',
    workspaceId: 'workspace_1',
    workspaceName: 'Chair One',
    salonName: 'Salon One',
    timezone: 'Asia/Ho_Chi_Minh',
    rentalOptionLabel: '2 hours',
    priceCents: 250_000,
    startsAt: '2026-08-28T02:00:00.000Z',
    endsAt: '2026-08-28T04:00:00.000Z',
    expiresAt: '2026-08-28T00:10:00.000Z'
  }
};
const myHolds: MyHoldsResponse = { holds: [createdHold.hold] };
const slotHolds = {
  create: jest.fn(async () => createdHold),
  getMine: jest.fn(async () => myHolds)
};
const professionalAccess = { assertActive: jest.fn().mockResolvedValue(undefined) };

@Module({
  controllers: [PublicAvailabilityController],
  providers: [
    { provide: PublicWorkspaceDetailService, useValue: workspaceDetails },
    { provide: SlotHoldsService, useValue: slotHolds },
    { provide: ProfessionalAccessService, useValue: professionalAccess },
    ProfessionalGuard,
    { provide: AccessTokenService, useValue: { verify: () => ({ sub: 'user_1', email: 'pro@example.test' }) } },
    { provide: PrismaService, useValue: { user: { findUnique: () => ({ id: 'user_1', email: 'pro@example.test', displayName: 'Professional', status: 'ACTIVE' }) } } },
    { provide: APP_FILTER, useClass: ApiExceptionFilter }
  ]
})
class PublicAvailabilityHttpContractModule {}

describe('public availability HTTP contract', () => {
  let baseUrl: string;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;

  beforeAll(async () => {
    app = await NestFactory.create(PublicAvailabilityHttpContractModule, { logger: false });
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

  it('accepts the YYYY-MM-DD detail query specified by D6', async () => {
    const response = await fetch(`${baseUrl}/workspaces/workspace_1?date=2026-08-28`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(detail);
    expect(workspaceDetails.get).toHaveBeenCalledWith('workspace_1', '2026-08-28');
  });

  it('rejects an invalid calendar date query before the detail service runs', async () => {
    const response = await fetch(`${baseUrl}/workspaces/workspace_1?date=tomorrow`);
    expect(response.status).toBe(400);
    expect(workspaceDetails.get).not.toHaveBeenCalled();
  });

  it('requires both an access token and an Idempotency-Key before holding a slot', async () => {
    const anonymous = await fetch(`${baseUrl}/availability/slots/slot_1/holds`, { method: 'POST', headers: { 'x-request-id': 'anonymous-hold-1' } });
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get('x-request-id')).toBe('anonymous-hold-1');
    await expect(anonymous.json()).resolves.toMatchObject({ requestId: 'anonymous-hold-1' });

    const noKey = await fetch(`${baseUrl}/availability/slots/slot_1/holds`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' }
    });
    expect(noKey.status).toBe(400);
    expect(slotHolds.create).not.toHaveBeenCalled();
  });

  it('forwards the authenticated user, idempotency key, and request id to the hold transaction', async () => {
    const response = await fetch(`${baseUrl}/availability/slots/slot_1/holds`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'idempotency-key': 'hold-retry-1',
        'x-request-id': 'request-1'
      }
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(createdHold);
    expect(slotHolds.create).toHaveBeenCalledWith('user_1', 'slot_1', 'hold-retry-1', 'request-1');
  });

  it('denies a caller without an active Professional profile before creating a hold', async () => {
    professionalAccess.assertActive.mockRejectedValueOnce(
      new ForbiddenException({ code: 'FORBIDDEN', message: 'An active Professional profile is required to reserve or manage bookings.' })
    );

    const response = await fetch(`${baseUrl}/availability/slots/slot_1/holds`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'idempotency-key': 'hold-denied-1' }
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ requestId: expect.any(String) });
    expect(slotHolds.create).not.toHaveBeenCalled();
  });

  it('restores the caller\'s active holds through GET /me/holds', async () => {
    const response = await fetch(`${baseUrl}/me/holds`, { headers: { authorization: 'Bearer test-token' } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(myHolds);
    expect(slotHolds.getMine).toHaveBeenCalledWith('user_1');
  });
});
