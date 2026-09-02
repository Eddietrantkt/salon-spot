import { Module } from '@nestjs/common';
import { SalonsModule } from '../salons/salons.module.js';
import { ProfessionalsModule } from '../professionals/professionals.module.js';
import { AvailabilityConfigService } from './application/availability-config.service.js';
import { AvailabilitySlotLockService } from './application/availability-slot-lock.service.js';
import { OwnerAvailabilityService } from './application/owner-availability.service.js';
import { PublicWorkspaceDetailService } from './application/public-workspace-detail.service.js';
import { SlotHoldsService } from './application/slot-holds.service.js';
import { OwnerAvailabilityController } from './presentation/owner-availability.controller.js';
import { PublicAvailabilityController } from './presentation/public-availability.controller.js';

/** Owns slot generation, blocks, holds and every availability-state transition. */
@Module({
  imports: [SalonsModule, ProfessionalsModule],
  controllers: [OwnerAvailabilityController, PublicAvailabilityController],
  providers: [AvailabilityConfigService, AvailabilitySlotLockService, OwnerAvailabilityService, PublicWorkspaceDetailService, SlotHoldsService],
  exports: [AvailabilityConfigService, AvailabilitySlotLockService, SlotHoldsService]
})
export class AvailabilityModule {}
