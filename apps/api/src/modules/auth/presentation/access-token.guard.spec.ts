import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AccessTokenService } from '../application/access-token.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

function contextFor(request: { headers: Record<string, string | undefined>; user?: unknown }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

describe('AccessTokenGuard', () => {
  const accessTokens = {
    verify: jest.fn(() => ({ sub: 'user_1', email: 'owner@example.com', iat: 1, exp: 2, typ: 'access' as const }))
  } as unknown as AccessTokenService;
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1', email: 'owner@example.com', displayName: 'Owner', status: 'ACTIVE' }) } } as unknown as PrismaService;
  const guard = new AccessTokenGuard(accessTokens, prisma);

  it('accepts a Bearer access token and establishes the current user context', async () => {
    const request = { headers: { authorization: 'Bearer signed-token' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toMatchObject({ user: { id: 'user_1', email: 'owner@example.com' } });
  });

  it('rejects an absent or malformed authorization header', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(contextFor({ headers: { authorization: 'Basic credentials' } }))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a suspended account even when its access token is otherwise valid', async () => {
    const suspendedPrisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1', email: 'owner@example.com', displayName: 'Owner', status: 'SUSPENDED' }) } } as unknown as PrismaService;
    const suspendedGuard = new AccessTokenGuard(accessTokens, suspendedPrisma);

    await expect(suspendedGuard.canActivate(contextFor({ headers: { authorization: 'Bearer signed-token' } }))).rejects.toThrow(UnauthorizedException);
  });
});
