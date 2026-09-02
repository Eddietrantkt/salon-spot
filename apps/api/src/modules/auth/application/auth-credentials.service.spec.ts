import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthConfigService } from './auth-config.service.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';

describe('AuthService credential lifecycle', () => {
  const accessTokens = {
    issue: jest.fn(() => ({ token: 'access-token', expiresAt: new Date(Date.now() + 60_000) }))
  } as unknown as AccessTokenService;
  const config = {
    hashRefreshToken: jest.fn((token: string) => `hashed-${token}`),
    refreshTokenTtlDays: 14
  } as unknown as AuthConfigService;

  it('registers a normalized account, persists only the password hash and audits the request', async () => {
    const userCreate = jest.fn().mockResolvedValue({ id: 'user_1', email: 'owner@example.com', displayName: 'Owner' });
    const sessionCreate = jest.fn().mockResolvedValue({ id: 'session_1' });
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = { user: { create: userCreate }, authSession: { create: sessionCreate }, auditEvent: { create: auditCreate } };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    } as unknown as PrismaService;
    const passwords = { hash: jest.fn().mockResolvedValue('scrypt$unique-salt$derived-key') } as unknown as PasswordService;
    const service = new AuthService(prisma, passwords, accessTokens, config);

    const result = await service.register(
      { email: ' Owner@Example.com ', displayName: ' Owner ', password: 'correct-horse-battery-staple' },
      'request_1'
    );

    expect(result).toMatchObject({ authentication: { accessToken: 'access-token', user: { id: 'user_1', email: 'owner@example.com', displayName: 'Owner' } } });
    expect(userCreate).toHaveBeenCalledWith({
      data: { email: 'owner@example.com', displayName: 'Owner', passwordHash: 'scrypt$unique-salt$derived-key' }
    });
    expect(sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user_1', refreshTokenHash: expect.any(String), familyId: expect.any(String) })
    });
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'AUTH_REGISTERED', requestId: 'request_1' }) });
  });

  it('rejects a duplicate email before creating a password hash or session', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1' }) } } as unknown as PrismaService;
    const passwords = { hash: jest.fn() } as unknown as PasswordService;
    const service = new AuthService(prisma, passwords, accessTokens, config);

    await expect(service.register({ email: 'owner@example.com', displayName: 'Owner', password: 'correct-horse-battery-staple' })).rejects.toThrow(ConflictException);
    expect(passwords.hash).not.toHaveBeenCalled();
  });

  it('returns one generic unauthorized result for an incorrect password', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user_1',
          email: 'owner@example.com',
          displayName: 'Owner',
          status: UserStatus.ACTIVE,
          passwordHash: 'scrypt$stored$hash'
        })
      }
    } as unknown as PrismaService;
    const passwords = { verify: jest.fn().mockResolvedValue(false) } as unknown as PasswordService;
    const service = new AuthService(prisma, passwords, accessTokens, config);

    await expect(service.login({ email: 'owner@example.com', password: 'wrong-password' })).rejects.toThrow(UnauthorizedException);
  });

  it('creates a session and audit event when valid credentials are supplied', async () => {
    const sessionCreate = jest.fn().mockResolvedValue({ id: 'session_1' });
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = { authSession: { create: sessionCreate }, auditEvent: { create: auditCreate } };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user_1',
          email: 'owner@example.com',
          displayName: 'Owner',
          status: UserStatus.ACTIVE,
          passwordHash: 'scrypt$stored$hash'
        })
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    } as unknown as PrismaService;
    const passwords = { verify: jest.fn().mockResolvedValue(true) } as unknown as PasswordService;
    const service = new AuthService(prisma, passwords, accessTokens, config);

    const result = await service.login({ email: 'OWNER@example.com', password: 'correct-horse-battery-staple' }, 'request_2');

    expect(result).toMatchObject({ authentication: { accessToken: 'access-token', user: { id: 'user_1', email: 'owner@example.com' } } });
    expect(sessionCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user_1' }) });
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'AUTH_LOGGED_IN', requestId: 'request_2' }) });
  });
});
