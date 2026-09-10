import { Controller, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { API_PREFIX, type AuthenticationResponse, type WorkspaceSearchResponse } from '@salon-spot/contracts';
import { HealthModule } from '../src/common/health/health.module.js';
import { RequestIdMiddleware } from '../src/common/http/request-id.middleware.js';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { AuthService } from '../src/modules/auth/application/auth.service.js';
import { AccessTokenGuard } from '../src/modules/auth/presentation/access-token.guard.js';
import { AuthController } from '../src/modules/auth/presentation/auth.controller.js';
import { SearchWorkspacesService } from '../src/modules/discovery/application/search-workspaces.service.js';
import { DiscoveryController } from '../src/modules/discovery/presentation/discovery.controller.js';

const authenticationResponse: AuthenticationResponse = {
  user: { id: 'user_1', email: 'owner@example.com', displayName: 'Owner' },
  capabilities: { professionalStatus: null, owner: true, admin: false },
  accessToken: 'access-token',
  accessTokenExpiresAt: '2026-08-24T01:00:00.000Z'
};

const authSessionResult = {
  authentication: authenticationResponse,
  refreshToken: 'refresh-token',
  refreshTokenExpiresAt: new Date('2026-09-07T00:00:00.000Z')
};

const workspaceSearchResponse: WorkspaceSearchResponse = {
  data: [{ workspaceId: 'workspace_1', workspaceName: 'Chair A', salonName: 'Salon One', area: 'D1', timezone: 'Asia/Ho_Chi_Minh', startingPriceCents: 250000, availableSlotCount: 2, media: [] }],
  meta: { page: 1, pageSize: 20, total: 1 }
};

const searchWorkspaces = { search: jest.fn(async () => workspaceSearchResponse) };
const authService = {
  register: jest.fn(async () => authSessionResult),
  login: jest.fn(async () => authSessionResult),
  refresh: jest.fn(async () => authSessionResult),
  logout: jest.fn(async () => undefined),
  getCurrentUser: jest.fn(async () => authenticationResponse.user)
};

@Module({
  imports: [HealthModule],
  controllers: [DiscoveryController, AuthController],
  providers: [
    { provide: SearchWorkspacesService, useValue: searchWorkspaces },
    { provide: AuthService, useValue: authService },
    { provide: AccessTokenGuard, useValue: { canActivate: () => true } },
    { provide: APP_FILTER, useClass: ApiExceptionFilter }
  ]
})
class HttpContractTestModule {}

describe('HTTP contracts', () => {
  let baseUrl: string;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;

  beforeAll(async () => {
    app = await NestFactory.create(HttpContractTestModule, { logger: false });
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

  it('returns health and preserves the request correlation ID', async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { 'x-request-id': 'health_123' } });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('health_123');
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', service: 'salon-spot-api' });
  });

  it('accepts a valid Discovery query and exposes the shared response contract', async () => {
    const response = await fetch(`${baseUrl}/workspaces?area=D1&date=2026-08-24`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(workspaceSearchResponse);
    expect(searchWorkspaces.search).toHaveBeenCalledWith({ area: 'D1', date: '2026-08-24' });
  });

  it('rejects invalid or unknown Discovery query fields before the application service runs', async () => {
    const response = await fetch(`${baseUrl}/workspaces?area=D1&date=invalid-date&unexpected=value`);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR', requestId: expect.any(String) });
    expect(searchWorkspaces.search).not.toHaveBeenCalled();
  });

  it('rejects a weak registration payload before the Auth service is called', async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', displayName: 'Owner', password: 'short' })
    });

    expect(response.status).toBe(400);
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('passes request ID into a valid registration and returns the authentication contract', async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'register_123' },
      body: JSON.stringify({ email: 'professional@example.com', displayName: 'Professional', password: 'correct-horse-battery-staple', onboardingIntent: 'PROFESSIONAL' })
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('x-request-id')).toBe('register_123');
    expect(response.headers.get('set-cookie')).toContain('salon_spot_refresh=refresh-token');
    await expect(response.json()).resolves.toEqual(authenticationResponse);
    expect(authService.register).toHaveBeenCalledWith(
      { email: 'professional@example.com', displayName: 'Professional', password: 'correct-horse-battery-staple', onboardingIntent: 'PROFESSIONAL' },
      'register_123'
    );
  });
});
