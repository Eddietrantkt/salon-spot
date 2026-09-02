import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from '@salon-spot/contracts';
import { ProfessionalAccessService } from '../application/professional-access.service.js';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

/** Use after AccessTokenGuard for Professional booking routes. */
@Injectable()
export class ProfessionalGuard implements CanActivate {
  constructor(private readonly professionals: ProfessionalAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) throw new UnauthorizedException();
    await this.professionals.assertActive(request.user.id);
    return true;
  }
}
