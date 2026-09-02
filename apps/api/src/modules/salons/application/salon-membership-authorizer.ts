import { ForbiddenException, Injectable } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

/** The object-level authorization seam for every future Owner-only Salon route. */
@Injectable()
export class SalonMembershipAuthorizer {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwner(userId: string, salonId: string): Promise<void> {
    const membership = await this.prisma.salonMembership.findUnique({
      where: { salonId_userId: { salonId, userId } },
      select: { role: true }
    });
    if (!membership || membership.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('You do not manage this Salon.');
    }
  }
}
