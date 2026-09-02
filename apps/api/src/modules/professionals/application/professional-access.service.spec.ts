import { ForbiddenException } from '@nestjs/common';
import { ProfessionalProfileStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { ProfessionalAccessService } from './professional-access.service.js';

describe('ProfessionalAccessService', () => {
  it('accepts an active Professional profile', async () => {
    const prisma = { professionalProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'professional_1', status: ProfessionalProfileStatus.ACTIVE }) } } as unknown as PrismaService;
    await expect(new ProfessionalAccessService(prisma).assertActive('professional_1')).resolves.toBeUndefined();
  });

  it.each([null, { userId: 'professional_1', status: ProfessionalProfileStatus.SUSPENDED }])('denies booking access without an active profile', async (profile) => {
    const prisma = { professionalProfile: { findUnique: jest.fn().mockResolvedValue(profile) } } as unknown as PrismaService;
    await expect(new ProfessionalAccessService(prisma).assertActive('professional_1')).rejects.toThrow(ForbiddenException);
  });
});
