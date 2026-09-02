import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

/** Verifies the platform-wide operations grant; it never consults SalonMembership. */
@Injectable()
export class AdminAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAdmin(userId: string): Promise<void> {
    const access = await this.prisma.adminAccess.findUnique({ where: { userId }, select: { userId: true } });
    if (!access) throw new ForbiddenException('Administrator access is required.');
  }
}
