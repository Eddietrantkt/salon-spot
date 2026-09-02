import { AvailabilitySlotStatus, BookingStatus, MembershipRole, OutboxStatus, PrismaClient, ProfessionalProfileStatus, WorkspaceStatus } from '@prisma/client';

const prisma = new PrismaClient();
const date = new Date('2099-12-20T00:00:00.000Z');
const startsAt = new Date('2099-12-20T02:00:00.000Z');

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({ data: [
      { id: 'p1_owner', email: 'p1-owner@example.test', displayName: 'P1 Owner', passwordHash: 'fixture-only' },
      { id: 'p1_professional', email: 'p1-professional@example.test', displayName: 'P1 Professional', passwordHash: 'fixture-only' }
    ] });
    await tx.professionalProfile.create({ data: { userId: 'p1_professional', status: ProfessionalProfileStatus.ACTIVE } });
    await tx.salon.create({ data: { id: 'p1_salon', name: 'P1 Restore Salon', area: 'Release', timezone: 'Asia/Ho_Chi_Minh' } });
    await tx.salonMembership.create({ data: { salonId: 'p1_salon', userId: 'p1_owner', role: MembershipRole.OWNER } });
    await tx.workspace.create({ data: { id: 'p1_workspace', salonId: 'p1_salon', name: 'P1 Restore Workspace', status: WorkspaceStatus.PUBLISHED } });
    await tx.rentalOption.create({ data: { id: 'p1_option', workspaceId: 'p1_workspace', label: '2 hours', priceCents: 250000 } });
    await tx.workspaceCalendarLock.create({ data: { workspaceId: 'p1_workspace', localDate: date } });
    await tx.availabilitySlot.createMany({ data: [
      { id: 'p1_slot_hold', workspaceId: 'p1_workspace', rentalOptionId: 'p1_option', localDate: date, startsAt, endsAt: new Date('2099-12-20T04:00:00.000Z'), status: AvailabilitySlotStatus.HELD },
      { id: 'p1_slot_booking', workspaceId: 'p1_workspace', rentalOptionId: 'p1_option', localDate: date, startsAt: new Date('2099-12-20T04:00:00.000Z'), endsAt: new Date('2099-12-20T06:00:00.000Z'), status: AvailabilitySlotStatus.BOOKED }
    ] });
    await tx.slotHold.create({ data: { id: 'p1_hold', availabilitySlotId: 'p1_slot_hold', professionalUserId: 'p1_professional', expiresAt: new Date('2099-12-19T00:00:00.000Z') } });
    await tx.booking.create({ data: { id: 'p1_booking', availabilitySlotId: 'p1_slot_booking', professionalUserId: 'p1_professional', status: BookingStatus.CONFIRMED, workspaceName: 'P1 Restore Workspace', rentalOptionLabel: '2 hours', priceCents: 250000, startsAt: new Date('2099-12-20T04:00:00.000Z'), endsAt: new Date('2099-12-20T06:00:00.000Z'), salonTimezone: 'Asia/Ho_Chi_Minh', localDate: date } });
    await tx.auditEvent.create({ data: { actorUserId: 'p1_owner', entityType: 'P1Fixture', entityId: 'p1_booking', action: 'P1_BACKUP_FIXTURE_CREATED' } });
    await tx.outboxEvent.create({ data: { topic: 'P1_BACKUP_FIXTURE', payload: { bookingId: 'p1_booking' }, status: OutboxStatus.PENDING } });
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unable to seed P1 backup fixture.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
