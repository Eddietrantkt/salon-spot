import { ForbiddenException, Injectable } from '@nestjs/common';
import { ProfessionalProfileStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

type ProfessionalClient = Pick<PrismaService, 'professionalProfile'> | Prisma.TransactionClient;

/** Authoritative policy for the Professional-only booking boundary. */
@Injectable()
export class ProfessionalAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertActive(userId: string, client: ProfessionalClient = this.prisma): Promise<void> {
    const profile = await client.professionalProfile.findUnique({
      where: { userId },
      select: { userId: true, status: true }
    });
    if (!profile || profile.status !== ProfessionalProfileStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'An active Professional profile is required to reserve or manage bookings.'
      });
    }
  }
}
