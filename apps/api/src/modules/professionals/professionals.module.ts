import { Module } from '@nestjs/common';
import { ProfessionalAccessService } from './application/professional-access.service.js';
import { ProfessionalProfileService } from './application/professional-profile.service.js';
import { ProfessionalGuard } from './presentation/professional.guard.js';
import { ProfessionalProfileController } from './presentation/professional-profile.controller.js';

/** Owns Professional booking eligibility and self-service onboarding details. */
@Module({
  controllers: [ProfessionalProfileController],
  providers: [ProfessionalAccessService, ProfessionalGuard, ProfessionalProfileService],
  exports: [ProfessionalAccessService, ProfessionalGuard]
})
export class ProfessionalsModule {}
