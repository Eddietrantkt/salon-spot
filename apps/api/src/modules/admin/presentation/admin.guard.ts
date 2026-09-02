import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from '@salon-spot/contracts';
import { AdminAccessService } from '../application/admin-access.service.js';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

/** Used after AccessTokenGuard to enforce the platform-wide operations boundary. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminAccess: AdminAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) throw new UnauthorizedException();
    await this.adminAccess.assertAdmin(request.user.id);
    return true;
  }
}
