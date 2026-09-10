import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import type { AuthenticatedUser } from '@salon-spot/contracts';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

/** Restricts the Owner portal to an explicit Owner journey or an existing OWNER membership. */
@Injectable()
export class OwnerPortalGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        ownerOnboardingSelectedAt: true,
        memberships: {
          where: { role: MembershipRole.OWNER },
          take: 1,
          select: { salonId: true }
        }
      }
    });
    if (!user || (!user.ownerOnboardingSelectedAt && user.memberships.length === 0)) {
      throw new ForbiddenException('This account does not have Owner portal access.');
    }
    return true;
  }
}
