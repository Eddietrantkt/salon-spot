import { Module } from '@nestjs/common';
import { SalonMembershipAuthorizer } from './application/salon-membership-authorizer.js';
import { OwnerSalonsService } from './application/owner-salons.service.js';
import { OwnerSalonsController } from './presentation/owner-salons.controller.js';
import { SalonOwnerGuard } from './presentation/salon-owner.guard.js';
import { OwnerPortalGuard } from './presentation/owner-portal.guard.js';

/** Owns Salon lifecycle and SalonMembership-based management scope. */
@Module({
  controllers: [OwnerSalonsController],
  providers: [SalonMembershipAuthorizer, SalonOwnerGuard, OwnerPortalGuard, OwnerSalonsService],
  exports: [SalonMembershipAuthorizer, SalonOwnerGuard]
})
export class SalonsModule {}
