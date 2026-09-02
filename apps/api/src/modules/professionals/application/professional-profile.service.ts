import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ProfessionalProfile, UpdateProfessionalProfileInput } from '@salon-spot/contracts';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';

const profileSelection = {
  userId: true,
  status: true,
  verificationStatus: true,
  phone: true,
  city: true,
  bio: true,
  specialties: true
} satisfies Prisma.ProfessionalProfileSelect;

/** Owns editable Professional identity details. Eligibility status remains platform-controlled. */
@Injectable()
export class ProfessionalProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(userId: string): Promise<ProfessionalProfile> {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId }, select: profileSelection });
    if (!profile) throw this.profileRequired();
    return this.toContract(profile);
  }

  async updateCurrent(userId: string, input: UpdateProfessionalProfileInput, requestId?: string): Promise<ProfessionalProfile> {
    if (input.phone === undefined && input.city === undefined && input.bio === undefined && input.specialties === undefined) {
      throw new BadRequestException('Provide at least one Professional profile field to update.');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.professionalProfile.findUnique({ where: { userId }, select: { userId: true } });
      if (!existing) throw this.profileRequired();

      const profile = await tx.professionalProfile.update({
        where: { userId },
        data: {
          phone: input.phone,
          city: input.city,
          bio: input.bio,
          specialties: input.specialties
        },
        select: profileSelection
      });
      const response = this.toContract(profile);
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          entityType: 'ProfessionalProfile',
          entityId: userId,
          action: 'PROFESSIONAL_PROFILE_UPDATED',
          requestId,
          after: {
            phone: response.phone,
            city: response.city,
            bio: response.bio,
            specialties: response.specialties
          }
        }
      });
      return response;
    });
  }

  private profileRequired(): NotFoundException {
    return new NotFoundException({ code: 'NOT_FOUND', message: 'Professional onboarding has not been selected for this account.' });
  }

  private toContract(profile: Prisma.ProfessionalProfileGetPayload<{ select: typeof profileSelection }>): ProfessionalProfile {
    return {
      ...profile,
      status: profile.status,
      verificationStatus: profile.verificationStatus,
      specialties: Array.isArray(profile.specialties) ? profile.specialties.filter((value): value is string => typeof value === 'string') : []
    };
  }
}
