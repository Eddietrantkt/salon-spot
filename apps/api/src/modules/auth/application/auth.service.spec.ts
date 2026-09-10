import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ProfessionalProfileStatus, ProfessionalVerificationStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthConfigService } from './auth-config.service.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';

describe('AuthService refresh rotation', () => {
  const futureDate = (): Date => new Date(Date.now() + 60_000);
  const accessTokens = {
    issue: jest.fn(() => ({ token: 'access-token', expiresAt: futureDate() }))
  } as unknown as AccessTokenService;
  const config = {
    hashRefreshToken: jest.fn((token: string) => `hashed-${token}`),
    refreshTokenTtlDays: 14
  } as unknown as AuthConfigService;
  const passwords = {} as PasswordService;

  it('rotates an active refresh token inside one transaction', async () => {
    const oldSession = {
      id: 'old_session',
      userId: 'user_1',
      familyId: 'family_1',
      expiresAt: futureDate(),
      revokedAt: null,
      user: { id: 'user_1', email: 'owner@example.com', displayName: 'Owner', status: UserStatus.ACTIVE, passwordHash: 'hash', ownerOnboardingSelectedAt: null, professionalProfile: null, adminAccess: null, memberships: [{ salonId: 'salon_1' }] }
    };
    const create = jest.fn().mockResolvedValue({ id: 'new_session' });
    const update = jest.fn().mockResolvedValue({});
    const auditCreate = jest.fn().mockResolvedValue({});
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      authSession: { findUnique: jest.fn().mockResolvedValue(oldSession), create, update, updateMany },
      auditEvent: { create: auditCreate }
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new AuthService(prisma, passwords, accessTokens, config);

    const result = await service.refresh('old-refresh-token', 'request_1');

    expect(result).toMatchObject({ authentication: { accessToken: 'access-token', user: { id: 'user_1' } } });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user_1', familyId: 'family_1', refreshTokenHash: expect.any(String) })
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'old_session' },
      data: { replacedById: 'new_session' }
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'old_session', revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { revokedAt: expect.any(Date) }
    });
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'AUTH_REFRESH_ROTATED', requestId: 'request_1' }) });
  });

  it('revokes the active session family when an old refresh token is reused', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'old_session',
          userId: 'user_1',
          familyId: 'family_1',
          expiresAt: futureDate(),
          revokedAt: new Date(),
          user: { id: 'user_1', email: 'owner@example.com', displayName: 'Owner', status: UserStatus.ACTIVE, passwordHash: 'hash', ownerOnboardingSelectedAt: null, professionalProfile: null, adminAccess: null, memberships: [{ salonId: 'salon_1' }] }
        }),
        create: jest.fn(),
        update: jest.fn(),
        updateMany
      },
      auditEvent: { create: auditCreate }
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new AuthService(prisma, passwords, accessTokens, config);

    await expect(service.refresh('reused-refresh-token')).rejects.toThrow(UnauthorizedException);
    expect(updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'AUTH_REFRESH_REUSE_DETECTED' }) });
  });

  it('does not create a second replacement when another request already claimed the refresh token', async () => {
    const create = jest.fn();
    const updateMany = jest.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'old_session',
          userId: 'user_1',
          familyId: 'family_1',
          expiresAt: futureDate(),
          revokedAt: null,
          user: { id: 'user_1', email: 'owner@example.com', displayName: 'Owner', status: UserStatus.ACTIVE, passwordHash: 'hash', ownerOnboardingSelectedAt: null, professionalProfile: null, adminAccess: null, memberships: [{ salonId: 'salon_1' }] }
        }),
        create,
        update: jest.fn(),
        updateMany
      },
      auditEvent: { create: auditCreate }
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new AuthService(prisma, passwords, accessTokens, config);

    await expect(service.refresh('racing-refresh-token')).rejects.toThrow(UnauthorizedException);
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'old_session', revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { revokedAt: expect.any(Date) }
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { familyId: 'family_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it('maps a concurrent unique email violation to a conflict response', async () => {
    const create = jest.fn().mockRejectedValue({ code: 'P2002' });
    const tx = {
      user: { create },
      authSession: { create: jest.fn() },
      auditEvent: { create: jest.fn() }
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    } as unknown as PrismaService;
    const passwords = { hash: jest.fn().mockResolvedValue('hash') } as unknown as PasswordService;
    const service = new AuthService(prisma, passwords, accessTokens, config);

    await expect(service.register({ email: 'owner@example.com', displayName: 'Owner', password: 'Mvp#2026' })).rejects.toThrow(ConflictException);
  });

  it('starts Professional onboarding in the same registration transaction', async () => {
    const profileCreate = jest.fn().mockResolvedValue({});
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      user: { create: jest.fn().mockResolvedValue({ id: 'professional_1', email: 'professional@example.com', displayName: 'Professional' }) },
      professionalProfile: { create: profileCreate },
      authSession: { create: jest.fn().mockResolvedValue({ id: 'session_1' }) },
      auditEvent: { create: auditCreate }
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    } as unknown as PrismaService;
    const passwords = { hash: jest.fn().mockResolvedValue('hash') } as unknown as PasswordService;
    const service = new AuthService(prisma, passwords, accessTokens, config);

    await service.register({ email: 'professional@example.com', displayName: 'Professional', password: 'Mvp#2026', onboardingIntent: 'PROFESSIONAL' }, 'registration_1');

    expect(profileCreate).toHaveBeenCalledWith({
      data: {
        userId: 'professional_1',
        status: ProfessionalProfileStatus.PENDING,
        verificationStatus: ProfessionalVerificationStatus.DRAFT,
        specialties: []
      }
    });
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'PROFESSIONAL_ONBOARDING_STARTED', requestId: 'registration_1' }) });
  });

  it('persists the Owner journey and returns Owner navigation capability at registration', async () => {
    const userCreate = jest.fn().mockResolvedValue({ id: 'owner_1', email: 'owner@example.com', displayName: 'Owner' });
    const tx = {
      user: { create: userCreate },
      authSession: { create: jest.fn().mockResolvedValue({ id: 'session_1' }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    } as unknown as PrismaService;
    const passwordService = { hash: jest.fn().mockResolvedValue('hash') } as unknown as PasswordService;
    const service = new AuthService(prisma, passwordService, accessTokens, config);

    const result = await service.register({ email: 'owner@example.com', displayName: 'Owner', password: 'Mvp#2026', onboardingIntent: 'OWNER' });

    expect(userCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ ownerOnboardingSelectedAt: expect.any(Date) }) });
    expect(result.authentication.capabilities).toEqual({ professionalStatus: null, owner: true, admin: false });
  });

  it('derives restored navigation capabilities from authoritative account relations', async () => {
    const user = {
      id: 'multi_role_1', email: 'multi@example.com', displayName: 'Multi Role', passwordHash: 'hash', status: UserStatus.ACTIVE,
      ownerOnboardingSelectedAt: null,
      professionalProfile: { status: ProfessionalProfileStatus.ACTIVE },
      adminAccess: { userId: 'multi_role_1' },
      memberships: [{ salonId: 'salon_1' }]
    };
    const tx = {
      authSession: { create: jest.fn().mockResolvedValue({ id: 'session_1' }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    } as unknown as PrismaService;
    const passwordService = { verify: jest.fn().mockResolvedValue(true) } as unknown as PasswordService;
    const service = new AuthService(prisma, passwordService, accessTokens, config);

    const result = await service.login({ email: user.email, password: 'Mvp#2026' });

    expect(result.authentication.capabilities).toEqual({ professionalStatus: ProfessionalProfileStatus.ACTIVE, owner: true, admin: true });
  });
});
