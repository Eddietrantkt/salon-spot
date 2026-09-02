import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { API_PREFIX } from '@salon-spot/contracts';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { RequestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { AdminAccessService } from '../src/modules/admin/application/admin-access.service.js';
import { AdminGuard } from '../src/modules/admin/presentation/admin.guard.js';
import { AccessTokenService } from '../src/modules/auth/application/access-token.service.js';
import { AccessTokenGuard } from '../src/modules/auth/presentation/access-token.guard.js';
import { ProfessionalAccessService } from '../src/modules/professionals/application/professional-access.service.js';
import { ProfessionalGuard } from '../src/modules/professionals/presentation/professional.guard.js';
import { SalonMembershipAuthorizer } from '../src/modules/salons/application/salon-membership-authorizer.js';
import { SalonOwnerGuard } from '../src/modules/salons/presentation/salon-owner.guard.js';

@Controller('request-id-probes')
@UseGuards(AccessTokenGuard)
class RequestIdProbeController {
  @Get('authenticated') authenticated(): { ok: true } { return { ok: true }; }

  @Get('professional')
  @UseGuards(ProfessionalGuard)
  professional(): { ok: true } { return { ok: true }; }

  @Get('salons/:salonId')
  @UseGuards(SalonOwnerGuard)
  salon(): { ok: true } { return { ok: true }; }

  @Get('admin')
  @UseGuards(AdminGuard)
  admin(): { ok: true } { return { ok: true }; }
}

const accessTokens = {
  verify: (token: string) => ({ sub: token === 'admin-token' ? 'admin_1' : 'owner_1', email: 'user@example.test' })
};
const prisma = {
  user: { findUnique: jest.fn(({ where }: { where: { id: string } }) => ({ id: where.id, email: 'user@example.test', displayName: 'User', status: 'ACTIVE' })) },
  professionalProfile: { findUnique: jest.fn().mockResolvedValue(null) },
  salonMembership: { findUnique: jest.fn().mockResolvedValue(null) },
  adminAccess: { findUnique: jest.fn().mockResolvedValue(null) }
};

@Module({
  controllers: [RequestIdProbeController],
  providers: [
    AccessTokenGuard,
    ProfessionalGuard,
    SalonOwnerGuard,
    AdminGuard,
    ProfessionalAccessService,
    SalonMembershipAuthorizer,
    AdminAccessService,
    { provide: AccessTokenService, useValue: accessTokens },
    { provide: PrismaService, useValue: prisma },
    { provide: APP_FILTER, useClass: ApiExceptionFilter }
  ]
})
class RequestIdGuardHttpContractModule {}

describe('request ID on guard denials', () => {
  let baseUrl: string;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;

  beforeAll(async () => {
    app = await NestFactory.create(RequestIdGuardHttpContractModule, { logger: false });
    const requestIds = new RequestIdMiddleware();
    app.use(requestIds.use.bind(requestIds));
    app.setGlobalPrefix(API_PREFIX);
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/${API_PREFIX}`;
  });

  afterAll(async () => app.close());

  it.each([
    ['missing token', '/request-id-probes/authenticated', undefined, 401, 'AUTHENTICATION_FAILED'],
    ['wrong Professional role', '/request-id-probes/professional', 'Bearer owner-token', 403, 'FORBIDDEN'],
    ['wrong Salon ownership', '/request-id-probes/salons/salon_other', 'Bearer owner-token', 403, 'FORBIDDEN'],
    ['missing Admin access', '/request-id-probes/admin', 'Bearer owner-token', 403, 'FORBIDDEN']
  ])('returns a correlated request ID for %s', async (_label, path, authorization, status, code) => {
    const requestId = `guard-denial-${code.toLowerCase()}`;
    const headers: Record<string, string> = { 'x-request-id': requestId };
    if (authorization) headers.authorization = authorization;

    const response = await fetch(`${baseUrl}${path}`, { headers });

    expect(response.status).toBe(status);
    expect(response.headers.get('x-request-id')).toBe(requestId);
    await expect(response.json()).resolves.toMatchObject({ code, requestId });
  });
});
