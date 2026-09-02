import { ProfessionalProfileStatus, ProfessionalVerificationStatus } from '@prisma/client';
import { ProfessionalProfileService } from '../application/professional-profile.service.js';
import { ProfessionalProfileController } from './professional-profile.controller.js';

describe('ProfessionalProfileController', () => {
  const user = { id: 'professional_1', email: 'professional@example.com', displayName: 'Professional' };
  const profile = {
    userId: user.id,
    status: ProfessionalProfileStatus.PENDING,
    verificationStatus: ProfessionalVerificationStatus.DRAFT,
    phone: null,
    city: null,
    bio: null,
    specialties: []
  };

  it('uses the authenticated User, never a client-supplied profile owner', async () => {
    const profiles = {
      getCurrent: jest.fn().mockResolvedValue(profile),
      updateCurrent: jest.fn().mockResolvedValue({ ...profile, city: 'District 3' })
    } as unknown as ProfessionalProfileService;
    const controller = new ProfessionalProfileController(profiles);

    await expect(controller.getCurrent(user)).resolves.toEqual(profile);
    await expect(controller.updateCurrent(user, { city: 'District 3' }, 'profile_123')).resolves.toMatchObject({ city: 'District 3' });
    expect(profiles.getCurrent).toHaveBeenCalledWith(user.id);
    expect(profiles.updateCurrent).toHaveBeenCalledWith(user.id, { city: 'District 3' }, 'profile_123');
  });
});
