import { ForbiddenException } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { SalonMembershipAuthorizer } from './salon-membership-authorizer.js';

describe('SalonMembershipAuthorizer', () => {
  it('allows an owner only in their own Salon scope', async () => {
    const findUnique = jest.fn().mockResolvedValue({ role: MembershipRole.OWNER });
    const prisma = { salonMembership: { findUnique } } as unknown as PrismaService;

    await expect(new SalonMembershipAuthorizer(prisma).assertOwner('user_1', 'salon_1')).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({
      where: { salonId_userId: { salonId: 'salon_1', userId: 'user_1' } },
      select: { role: true }
    });
  });

  it('rejects a user without a membership', async () => {
    const prisma = { salonMembership: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;

    await expect(new SalonMembershipAuthorizer(prisma).assertOwner('user_1', 'salon_2')).rejects.toThrow(ForbiddenException);
  });
});
