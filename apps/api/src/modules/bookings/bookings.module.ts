import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { ProfessionalsModule } from '../professionals/professionals.module.js';
import { BookingsService } from './application/bookings.service.js';
import { BookingsController } from './presentation/bookings.controller.js';

/** Owns Booking lifecycle, immutable snapshots and cancellation policy. */
@Module({
  imports: [AvailabilityModule, ProfessionalsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService]
})
export class BookingsModule {}
