import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProfessionalProfileStatus, ProfessionalVerificationStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { ProfessionalProfileService } from './professional-profile.service.js';

describe('ProfessionalProfileService', () => {
  const profile = {
    userId: 'professional_1',
    status: ProfessionalProfileStatus.PENDING,
    verificationStatus: ProfessionalVerificationStatus.DRAFT,
    phone: null,
    city: null,
    bio: null,
    specialties: ['Hair styling']
  };

  it('returns a profile but never needs a mutable can-book field', async () => {
    const prisma = { professionalProfile: { findUnique: jest.fn().mockResolvedValue(profile) } } as unknown as PrismaService;
    await expect(new ProfessionalProfileService(prisma).getCurrent('professional_1')).resolves.toEqual(profile);
  });

  it('updates only editable details and writes an audit event atomically', async () => {
    const update = jest.fn().mockResolvedValue({ ...profile, city: 'District 3', specialties: ['Hair styling', 'Colouring'] });
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      professionalProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'professional_1' }), update },
      auditEvent: { create: auditCreate }
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new ProfessionalProfileService(prisma);

    await expect(service.updateCurrent('professional_1', { city: 'District 3', specialties: ['Hair styling', 'Colouring'] }, 'profile_1')).resolves.toMatchObject({ city: 'District 3' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'professional_1' },
      data: { phone: undefined, city: 'District 3', bio: undefined, specialties: ['Hair styling', 'Colouring'] }
    }));
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'PROFESSIONAL_PROFILE_UPDATED', requestId: 'profile_1' }) });
  });

  it('rejects an empty patch and users who never selected Professional onboarding', async () => {
    const service = new ProfessionalProfileService({} as PrismaService);
    await expect(service.updateCurrent('professional_1', {})).rejects.toThrow(BadRequestException);

    const prisma = { professionalProfile: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    await expect(new ProfessionalProfileService(prisma).getCurrent('owner_1')).rejects.toThrow(NotFoundException);
  });
});
