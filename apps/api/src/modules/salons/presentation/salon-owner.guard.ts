import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from '@salon-spot/contracts';
import { SalonMembershipAuthorizer } from '../application/salon-membership-authorizer.js';

interface RequestWithSalonContext {
  params: Record<string, string | undefined>;
  user?: AuthenticatedUser;
}

/** Use after AccessTokenGuard on routes whose parameter is named :salonId. */
@Injectable()
export class SalonOwnerGuard implements CanActivate {
  constructor(private readonly memberships: SalonMembershipAuthorizer) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSalonContext>();
    if (!request.user) throw new UnauthorizedException();
    const salonId = request.params.salonId;
    if (!salonId) throw new UnauthorizedException('Route is missing a salonId.');
    await this.memberships.assertOwner(request.user.id, salonId);
    return true;
  }
}
