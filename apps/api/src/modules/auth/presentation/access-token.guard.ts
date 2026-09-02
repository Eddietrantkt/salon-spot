import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '@salon-spot/contracts';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { AccessTokenService } from '../application/access-token.service.js';

interface RequestWithHeaders {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly accessTokens: AccessTokenService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const header = request.headers.authorization;
    if (typeof header !== 'string') throw new UnauthorizedException();
    const [scheme, token, ...extra] = header.split(' ');
    if (scheme !== 'Bearer' || !token || extra.length > 0) throw new UnauthorizedException();

    const claims = this.accessTokens.verify(token);
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub }, select: { id: true, email: true, displayName: true, status: true } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Account is not active.');
    request.user = { id: user.id, email: user.email, displayName: user.displayName };
    return true;
  }
}
