import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AvailabilitySlotStatus, BookingStatus, Prisma } from '@prisma/client';
import type { BookingDetailResponse, BookingSummary, CancelBookingResponse, ConfirmHoldResponse, MyBookingsResponse } from '@salon-spot/contracts';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { executeIdempotently } from '../../../common/http/idempotency.js';
import { AvailabilitySlotLockService } from '../../availability/application/availability-slot-lock.service.js';
import { ProfessionalAccessService } from '../../professionals/application/professional-access.service.js';

const CANCELLATION_REOPEN_WINDOW_MS = 10 * 60 * 60 * 1_000;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locks: AvailabilitySlotLockService,
    private readonly professionals: ProfessionalAccessService
  ) {}

  async confirm(actorUserId: string, holdId: string, idempotencyKey: string, requestId?: string): Promise<ConfirmHoldResponse> {
    await this.professionals.assertActive(actorUserId);
    return executeIdempotently(this.prisma, actorUserId, `booking-confirm-hold:${holdId}`, idempotencyKey, { holdId }, async (tx) => {
      await this.professionals.assertActive(actorUserId, tx);
      const candidate = await tx.slotHold.findUnique({ where: { id: holdId }, select: { id: true, availabilitySlotId: true, professionalUserId: true } });
      if (!candidate || candidate.professionalUserId !== actorUserId) throw new NotFoundException('Active slot hold was not found.');
      const slot = await this.locks.lockSlot(tx, candidate.availabilitySlotId);
      const hold = slot.hold;
      if (!hold || hold.id !== holdId || hold.professionalUserId !== actorUserId || hold.expiresAt <= new Date() || slot.status !== AvailabilitySlotStatus.HELD) {
        throw expiredHold();
      }
      const booking = await tx.booking.create({
        data: {
          availabilitySlotId: slot.id,
          professionalUserId: actorUserId,
          workspaceName: slot.workspace.name,
          rentalOptionLabel: slot.rentalOption.label,
          priceCents: slot.rentalOption.priceCents,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          salonTimezone: slot.workspace.salon.timezone,
          localDate: slot.localDate
        }
      });
      const consumed = await tx.slotHold.deleteMany({ where: { id: holdId, professionalUserId: actorUserId } });
      if (consumed.count !== 1) throw expiredHold();
      const booked = await tx.availabilitySlot.updateMany({ where: { id: slot.id, status: AvailabilitySlotStatus.HELD }, data: { status: AvailabilitySlotStatus.BOOKED } });
      if (booked.count !== 1) throw new Error('Booking was created without consuming its held availability slot.');
      const response = { booking: toSummary(booking) };
      await tx.auditEvent.create({ data: { actorUserId, entityType: 'Booking', entityId: booking.id, action: 'BOOKING_CONFIRMED', requestId, after: { holdId, slotId: slot.id } } });
      await tx.outboxEvent.create({ data: { topic: 'BOOKING_CONFIRMED', payload: { bookingId: booking.id, professionalUserId: actorUserId } } });
      return response;
    });
  }

  async getMine(actorUserId: string): Promise<MyBookingsResponse> {
    await this.professionals.assertActive(actorUserId);
    const bookings = await this.prisma.booking.findMany({
      where: { professionalUserId: actorUserId },
      orderBy: { startsAt: 'desc' },
      include: { review: { select: { id: true } } }
    });
    return { bookings: bookings.map(toSummary) };
  }

  async getMineById(actorUserId: string, bookingId: string): Promise<BookingDetailResponse> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        OR: [
          { professionalUserId: actorUserId },
          { slot: { workspace: { salon: { memberships: { some: { userId: actorUserId } } } } } }
        ]
      },
      include: { review: { select: { id: true } } }
    });
    if (!booking) throw new NotFoundException('Booking was not found.');
    const isBookingProfessional = booking.professionalUserId === actorUserId;
    return {
      booking: toSummary(booking),
      viewerCanCancel: isBookingProfessional,
      viewerCanReview: isBookingProfessional && booking.status === BookingStatus.COMPLETED && booking.review === null
    };
  }

  async cancel(actorUserId: string, bookingId: string, idempotencyKey: string, requestId?: string): Promise<CancelBookingResponse> {
    await this.professionals.assertActive(actorUserId);
    return executeIdempotently(this.prisma, actorUserId, `booking-cancel:${bookingId}`, idempotencyKey, { bookingId }, async (tx) => {
      await this.professionals.assertActive(actorUserId, tx);
      const candidate = await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, availabilitySlotId: true, professionalUserId: true } });
      if (!candidate) throw new NotFoundException('Booking was not found.');
      if (candidate.professionalUserId !== actorUserId) throw new ForbiddenException('Only the booking owner can cancel this booking.');
      await this.locks.lockSlot(tx, candidate.availabilitySlotId);
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM Booking WHERE id = ${bookingId} FOR UPDATE`);
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking || booking.status !== BookingStatus.CONFIRMED) throw new ConflictException({ code: 'CONFLICT', message: 'Only a confirmed booking can be cancelled.' });
      if (booking.startsAt.getTime() - Date.now() <= CANCELLATION_REOPEN_WINDOW_MS) {
        throw new ConflictException({ code: 'CANCELLATION_WINDOW_CLOSED', message: 'Bookings can be cancelled only more than 10 hours before the start time.' });
      }
      const cancelledAt = new Date();
      const cancelled = await tx.booking.updateMany({ where: { id: booking.id, status: BookingStatus.CONFIRMED }, data: { status: BookingStatus.CANCELLED, cancelledAt } });
      if (cancelled.count !== 1) throw new ConflictException({ code: 'CONFLICT', message: 'Booking state changed. Refresh and try again.' });
      const reopened = await tx.availabilitySlot.updateMany({ where: { id: booking.availabilitySlotId, status: AvailabilitySlotStatus.BOOKED }, data: { status: AvailabilitySlotStatus.OPEN } });
      if (reopened.count !== 1) throw new Error('Cancelled booking did not reopen its booked slot.');
      const response = { booking: toSummary({ ...booking, status: BookingStatus.CANCELLED, cancelledAt }) };
      await tx.auditEvent.create({ data: { actorUserId, entityType: 'Booking', entityId: booking.id, action: 'BOOKING_CANCELLED', requestId, after: { reopenedSlotId: booking.availabilitySlotId } } });
      await tx.outboxEvent.create({ data: { topic: 'BOOKING_CANCELLED', payload: { bookingId: booking.id, professionalUserId: actorUserId } } });
      return response;
    });
  }

  async completeEndedBookings(limit = 50, now = new Date()): Promise<number> {
    const candidates = await this.prisma.booking.findMany({
      where: { status: BookingStatus.CONFIRMED, endsAt: { lte: now } },
      orderBy: { endsAt: 'asc' },
      take: limit,
      select: { id: true, availabilitySlotId: true }
    });
    let completed = 0;
    for (const candidate of candidates) {
      const changed = await this.prisma.$transaction(async (tx) => {
        await this.locks.lockSlot(tx, candidate.availabilitySlotId);
        await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM Booking WHERE id = ${candidate.id} FOR UPDATE`);
        const result = await tx.booking.updateMany({
          where: { id: candidate.id, status: BookingStatus.CONFIRMED, endsAt: { lte: now } },
          data: { status: BookingStatus.COMPLETED, completedAt: now }
        });
        if (result.count !== 1) return false;
        await tx.auditEvent.create({ data: { entityType: 'Booking', entityId: candidate.id, action: 'BOOKING_COMPLETED' } });
        await tx.outboxEvent.create({ data: { topic: 'BOOKING_COMPLETED', payload: { bookingId: candidate.id } } });
        return true;
      });
      if (changed) completed += 1;
    }
    return completed;
  }
}

function expiredHold(): ConflictException {
  return new ConflictException({ code: 'HOLD_EXPIRED', message: 'This hold has expired or is no longer active. Choose an available slot again.' });
}

function toSummary(booking: {
  id: string; status: BookingStatus; workspaceName: string; rentalOptionLabel: string; priceCents: number; startsAt: Date; endsAt: Date; salonTimezone: string; localDate: Date; cancelledAt: Date | null; completedAt: Date | null; review?: { id: string } | null;
}): BookingSummary {
  return {
    id: booking.id,
    status: booking.status,
    workspaceName: booking.workspaceName,
    rentalOptionLabel: booking.rentalOptionLabel,
    priceCents: booking.priceCents,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    salonTimezone: booking.salonTimezone,
    localDate: booking.localDate.toISOString().slice(0, 10),
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    completedAt: booking.completedAt?.toISOString() ?? null,
    reviewId: booking.review?.id ?? null
  };
}
