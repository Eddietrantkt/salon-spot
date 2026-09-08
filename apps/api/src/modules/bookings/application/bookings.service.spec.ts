import { AvailabilitySlotStatus, BookingStatus, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma/prisma.service.js';
import { AvailabilitySlotLockService } from '../../availability/application/availability-slot-lock.service.js';
import { ProfessionalAccessService } from '../../professionals/application/professional-access.service.js';
import { BookingsService } from './bookings.service.js';

describe('BookingsService', () => {
  it('confirms its own unexpired hold with an immutable booking snapshot and BOOKED slot', async () => {
    const tx = transactionHarness();
    const prisma = prismaHarness(tx);
    const locks = { lockSlot: jest.fn().mockResolvedValue(heldSlot()) } as unknown as AvailabilitySlotLockService;
    const service = new BookingsService(prisma, locks, activeProfessional());

    const result = await service.confirm('professional_1', 'hold_1', 'confirm-key', 'request_1');

    expect(locks.lockSlot).toHaveBeenCalledWith(tx, 'slot_1');
    expect(tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ availabilitySlotId: 'slot_1', workspaceName: 'Chair One', priceCents: 250000, salonTimezone: 'Asia/Ho_Chi_Minh', localDate: new Date('2099-12-11T00:00:00.000Z') }) }));
    expect(tx.slotHold.deleteMany).toHaveBeenCalledWith({ where: { id: 'hold_1', professionalUserId: 'professional_1' } });
    expect(tx.availabilitySlot.updateMany).toHaveBeenCalledWith({ where: { id: 'slot_1', status: AvailabilitySlotStatus.HELD }, data: { status: AvailabilitySlotStatus.BOOKED } });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: { topic: 'BOOKING_CONFIRMED', payload: { bookingId: 'booking_1', professionalUserId: 'professional_1' } } });
    expect(result.booking.status).toBe('CONFIRMED');
  });

  it('rejects cancellation at or inside the ten-hour reopening window', async () => {
    const tx = transactionHarness();
    const startsAt = new Date(Date.now() + 10 * 60 * 60 * 1_000);
    tx.booking.findUnique.mockResolvedValueOnce({ id: 'booking_1', availabilitySlotId: 'slot_1', professionalUserId: 'professional_1' }).mockResolvedValueOnce(booking({ startsAt }));
    const prisma = prismaHarness(tx);
    const locks = { lockSlot: jest.fn().mockResolvedValue(bookedSlot()) } as unknown as AvailabilitySlotLockService;
    const service = new BookingsService(prisma, locks, activeProfessional());

    await expect(service.cancel('professional_1', 'booking_1', 'cancel-key')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CANCELLATION_WINDOW_CLOSED' }) });
    expect(tx.availabilitySlot.updateMany).not.toHaveBeenCalled();
  });

  it('does not let another user confirm a hold they do not own', async () => {
    const tx = transactionHarness();
    const prisma = prismaHarness(tx);
    const locks = { lockSlot: jest.fn() } as unknown as AvailabilitySlotLockService;
    const service = new BookingsService(prisma, locks, activeProfessional());

    await expect(service.confirm('professional_2', 'hold_1', 'cross-user-key')).rejects.toMatchObject({ response: expect.anything() });
    expect(locks.lockSlot).not.toHaveBeenCalled();
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('cancels an eligible booking, reopens its slot and writes an outbox event', async () => {
    const tx = transactionHarness();
    const eligible = booking({ startsAt: new Date(Date.now() + 11 * 60 * 60 * 1_000) });
    tx.booking.findUnique.mockResolvedValueOnce({ id: 'booking_1', availabilitySlotId: 'slot_1', professionalUserId: 'professional_1' }).mockResolvedValueOnce(eligible);
    const prisma = prismaHarness(tx);
    const locks = { lockSlot: jest.fn().mockResolvedValue(bookedSlot()) } as unknown as AvailabilitySlotLockService;
    const service = new BookingsService(prisma, locks, activeProfessional());

    const result = await service.cancel('professional_1', 'booking_1', 'cancel-key');

    expect(result.booking.status).toBe('CANCELLED');
    expect(tx.availabilitySlot.updateMany).toHaveBeenCalledWith({ where: { id: 'slot_1', status: AvailabilitySlotStatus.BOOKED }, data: { status: AvailabilitySlotStatus.OPEN } });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: { topic: 'BOOKING_CANCELLED', payload: { bookingId: 'booking_1', professionalUserId: 'professional_1' } } });
  });

  it('completes a past confirmed booking exactly once and emits completion notification', async () => {
    const tx = transactionHarness();
    const prisma = prismaHarness(tx);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: 'booking_1', availabilitySlotId: 'slot_1' }]);
    const locks = { lockSlot: jest.fn().mockResolvedValue(bookedSlot()) } as unknown as AvailabilitySlotLockService;
    const service = new BookingsService(prisma, locks, activeProfessional());
    const now = new Date('2099-12-12T05:00:00.000Z');

    await expect(service.completeEndedBookings(10, now)).resolves.toBe(1);
    expect(tx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'booking_1', status: BookingStatus.CONFIRMED, endsAt: { lte: now } },
      data: { status: BookingStatus.COMPLETED, completedAt: now }
    }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: { topic: 'BOOKING_COMPLETED', payload: { bookingId: 'booking_1' } } });
  });

  it('returns one booking to its Professional or Salon Owner with role-safe actions', async () => {
    const prisma = prismaHarness(transactionHarness());
    (prisma.booking.findFirst as jest.Mock)
      .mockResolvedValueOnce(booking())
      .mockResolvedValueOnce(booking());
    const service = new BookingsService(prisma, {} as AvailabilitySlotLockService, activeProfessional());

    await expect(service.getMineById('professional_1', 'booking_1')).resolves.toMatchObject({ viewerCanCancel: true });
    await expect(service.getMineById('owner_1', 'booking_1')).resolves.toMatchObject({ viewerCanCancel: false });
    expect(prisma.booking.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ id: 'booking_1', OR: expect.any(Array) })
    }));
  });
});

function heldSlot() {
  return { id: 'slot_1', localDate: new Date('2099-12-11T00:00:00.000Z'), startsAt: new Date('2099-12-11T02:00:00.000Z'), endsAt: new Date('2099-12-11T04:00:00.000Z'), status: AvailabilitySlotStatus.HELD, workspace: { name: 'Chair One', status: WorkspaceStatus.PUBLISHED, salon: { name: 'Salon One', timezone: 'Asia/Ho_Chi_Minh' } }, rentalOption: { label: '2 giờ', priceCents: 250000 }, hold: { id: 'hold_1', professionalUserId: 'professional_1', expiresAt: new Date('2099-12-10T00:10:00.000Z') }, booking: null };
}

function bookedSlot() { return { ...heldSlot(), status: AvailabilitySlotStatus.BOOKED, hold: null }; }

function booking(overrides: Partial<{ startsAt: Date }> = {}) {
  return { id: 'booking_1', availabilitySlotId: 'slot_1', professionalUserId: 'professional_1', status: BookingStatus.CONFIRMED, workspaceName: 'Chair One', rentalOptionLabel: '2 giờ', priceCents: 250000, startsAt: new Date('2099-12-12T02:00:00.000Z'), endsAt: new Date('2099-12-12T04:00:00.000Z'), salonTimezone: 'Asia/Ho_Chi_Minh', localDate: new Date('2099-12-12T00:00:00.000Z'), cancelledAt: null, completedAt: null, createdAt: new Date(), ...overrides };
}

function activeProfessional(): ProfessionalAccessService {
  return { assertActive: jest.fn().mockResolvedValue(undefined) } as unknown as ProfessionalAccessService;
}

function transactionHarness() {
  return {
    slotHold: { findUnique: jest.fn().mockResolvedValue({ id: 'hold_1', availabilitySlotId: 'slot_1', professionalUserId: 'professional_1' }), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    booking: { create: jest.fn().mockResolvedValue(booking()), findUnique: jest.fn().mockResolvedValue(booking()), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    availabilitySlot: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) }, outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    $queryRaw: jest.fn().mockResolvedValue([]), idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) }
  };
}

function prismaHarness(tx: ReturnType<typeof transactionHarness>) {
  return { idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)), booking: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() } } as unknown as PrismaService;
}
