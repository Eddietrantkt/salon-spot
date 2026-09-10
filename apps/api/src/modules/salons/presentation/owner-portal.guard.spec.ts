import { ForbiddenException } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { OwnerPortalGuard } from './owner-portal.guard.js';

function contextFor(userId: string) {
  return { switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }) } as never;
}

describe('OwnerPortalGuard', () => {
  it('allows an account that selected the Owner journey before its first Salon exists', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ ownerOnboardingSelectedAt: new Date(), memberships: [] }) } } as unknown as PrismaService;
    await expect(new OwnerPortalGuard(prisma).canActivate(contextFor('owner_1'))).resolves.toBe(true);
  });

  it('allows an existing Salon owner and rejects an unrelated authenticated account', async () => {
    const findUnique = jest.fn()
      .mockResolvedValueOnce({ ownerOnboardingSelectedAt: null, memberships: [{ salonId: 'salon_1' }] })
      .mockResolvedValueOnce({ ownerOnboardingSelectedAt: null, memberships: [] });
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const guard = new OwnerPortalGuard(prisma);

    await expect(guard.canActivate(contextFor('owner_1'))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor('professional_1'))).rejects.toThrow(ForbiddenException);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ memberships: expect.objectContaining({ where: { role: MembershipRole.OWNER } }) })
    }));
  });
});
