import { AvailabilitySlotStatus, MembershipRole, ProfessionalProfileStatus, WorkspaceStatus } from '@prisma/client';
import { FIXED_SLOT_PERIODS } from '@salon-spot/contracts';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';
import { OwnerAvailabilityService } from '../src/modules/availability/application/owner-availability.service.js';
import { AvailabilityConfigService } from '../src/modules/availability/application/availability-config.service.js';
import { AvailabilitySlotLockService } from '../src/modules/availability/application/availability-slot-lock.service.js';
import { SlotHoldsService } from '../src/modules/availability/application/slot-holds.service.js';
import { BookingsService } from '../src/modules/bookings/application/bookings.service.js';
import { ProfessionalAccessService } from '../src/modules/professionals/application/professional-access.service.js';

const describeMySql = process.env.RUN_MYSQL_E2E === '1' ? describe : describe.skip;

describeMySql('OwnerAvailabilityService MySQL concurrency', () => {
  const prisma = new PrismaService();
  const suffix = `${Date.now()}`;
  const userId = `e2eu${suffix}`;
  const salonId = `e2es${suffix}`;
  const workspaceId = `e2ew${suffix}`;
  const rentalOptionId = `e2er${suffix}`;
  const professionalAId = `e2epa${suffix}`;
  const professionalBId = `e2epb${suffix}`;
  const localDates = ['2099-12-12', '2099-12-13', '2099-12-14', '2099-12-15', '2099-12-16'];

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.create({
      data: {
        id: userId,
        email: `availability-${suffix}@example.test`,
        displayName: 'Availability E2E Owner',
        passwordHash: '!integration-test-only!'
      }
    });
    await prisma.salon.create({
      data: { id: salonId, name: 'Availability E2E Salon', area: 'Test Area', timezone: 'Asia/Ho_Chi_Minh' }
    });
    await prisma.salonMembership.create({ data: { salonId, userId, role: MembershipRole.OWNER } });
    await prisma.workspace.create({
      data: { id: workspaceId, salonId, name: 'Availability E2E Workspace', status: WorkspaceStatus.PUBLISHED }
    });
    await prisma.rentalOption.create({
      data: { id: rentalOptionId, workspaceId, label: '2 giờ', priceCents: 250000 }
    });
    await prisma.user.createMany({ data: [
      { id: professionalAId, email: `professional-a-${suffix}@example.test`, displayName: 'Professional A', passwordHash: '!integration-test-only!' },
      { id: professionalBId, email: `professional-b-${suffix}@example.test`, displayName: 'Professional B', passwordHash: '!integration-test-only!' }
    ] });
    await prisma.professionalProfile.createMany({ data: [
      { userId: professionalAId, status: ProfessionalProfileStatus.ACTIVE },
      { userId: professionalBId, status: ProfessionalProfileStatus.ACTIVE }
    ] });
  });

  afterAll(async () => {
    await prisma.idempotencyRecord.deleteMany({ where: { actorUserId: { in: [userId, professionalAId, professionalBId] } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: workspaceId } });
    await prisma.booking.deleteMany({ where: { slot: { workspaceId } } });
    await prisma.slotHold.deleteMany({ where: { slot: { workspaceId } } });
    await prisma.availabilitySlot.deleteMany({ where: { workspaceId } });
    await prisma.workspaceCalendarLock.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.salon.deleteMany({ where: { id: salonId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, professionalAId, professionalBId] } } });
    await prisma.$disconnect();
  });

  it('repeatedly serializes concurrent open/block batches without leaving a mixed day state', async () => {
    const service = new OwnerAvailabilityService(prisma);
    for (const [index, localDate] of localDates.entries()) {
      await Promise.all([
        service.openFixedSlots(
          salonId,
          workspaceId,
          userId,
          { localDate, periods: [...FIXED_SLOT_PERIODS] },
          `open-${suffix}-${index}`
        ),
        service.blockFixedSlots(
          salonId,
          workspaceId,
          userId,
          { localDate, periods: [...FIXED_SLOT_PERIODS] },
          `block-${suffix}-${index}`
        )
      ]);

      const slots = await prisma.availabilitySlot.findMany({
        where: { workspaceId, localDate: new Date(`${localDate}T00:00:00.000Z`) },
        orderBy: { startsAt: 'asc' }
      });
      expect(slots).toHaveLength(4);
      expect(new Set(slots.map((slot) => slot.status)).size).toBe(1);
      expect([AvailabilitySlotStatus.OPEN, AvailabilitySlotStatus.BLOCKED]).toContain(slots[0]?.status);
    }

    const schedule = await service.getSchedule(salonId, workspaceId, localDates[0]!);
    expect(schedule.slots.map((slot) => slot.period)).toEqual(FIXED_SLOT_PERIODS);
  }, 30_000);

  it('lets exactly one Professional hold, confirm and cancel a slot on real MySQL', async () => {
    const ownerAvailability = new OwnerAvailabilityService(prisma);
    const locks = new AvailabilitySlotLockService();
    const professionals = new ProfessionalAccessService(prisma);
    const config = new AvailabilityConfigService({ get: () => '600' } as never);
    const holds = new SlotHoldsService(prisma, config, locks, professionals);
    const bookings = new BookingsService(prisma, locks, professionals);
    const localDate = '2099-12-17';
    await ownerAvailability.openFixedSlots(salonId, workspaceId, userId, { localDate, periods: ['09:00-11:00'] }, `hold-open-${suffix}`);
    const slot = await prisma.availabilitySlot.findFirstOrThrow({ where: { workspaceId, localDate: new Date(`${localDate}T00:00:00.000Z`) } });

    const attempts = await Promise.allSettled([
      holds.create(professionalAId, slot.id, `hold-a-${suffix}`),
      holds.create(professionalBId, slot.id, `hold-b-${suffix}`)
    ]);
    const winnerIndex = attempts.findIndex((attempt) => attempt.status === 'fulfilled');
    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    const winner = attempts[winnerIndex] as PromiseFulfilledResult<Awaited<ReturnType<typeof holds.create>>>;
    const winnerUserId = winnerIndex === 0 ? professionalAId : professionalBId;
    const confirmed = await bookings.confirm(winnerUserId, winner.value.hold.id, `confirm-${suffix}`);
    expect(confirmed.booking.status).toBe('CONFIRMED');
    await bookings.cancel(winnerUserId, confirmed.booking.id, `cancel-${suffix}`);

    await expect(prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } })).resolves.toMatchObject({ status: AvailabilitySlotStatus.OPEN });
    await expect(prisma.slotHold.count({ where: { availabilitySlotId: slot.id } })).resolves.toBe(0);
  }, 30_000);

  it('replays an idempotent hold without duplicating it and denies cross-user confirmation', async () => {
    const ownerAvailability = new OwnerAvailabilityService(prisma);
    const locks = new AvailabilitySlotLockService();
    const professionals = new ProfessionalAccessService(prisma);
    const holds = new SlotHoldsService(prisma, new AvailabilityConfigService({ get: () => '600' } as never), locks, professionals);
    const bookings = new BookingsService(prisma, locks, professionals);
    const localDate = '2099-12-18';
    await ownerAvailability.openFixedSlots(salonId, workspaceId, userId, { localDate, periods: ['09:00-11:00'] }, `idempotent-open-${suffix}`);
    const slot = await prisma.availabilitySlot.findFirstOrThrow({ where: { workspaceId, localDate: new Date(`${localDate}T00:00:00.000Z`) } });

    const initial = await holds.create(professionalAId, slot.id, `same-hold-${suffix}`);
    const replay = await holds.create(professionalAId, slot.id, `same-hold-${suffix}`);
    expect(replay.hold.id).toBe(initial.hold.id);
    await expect(prisma.slotHold.count({ where: { availabilitySlotId: slot.id } })).resolves.toBe(1);
    await expect(bookings.confirm(professionalBId, initial.hold.id, `cross-user-confirm-${suffix}`)).rejects.toBeDefined();
    await expect(prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } })).resolves.toMatchObject({ status: AvailabilitySlotStatus.HELD });
  }, 30_000);

  it('serializes expiry against confirmation so the slot ends OPEN or BOOKED, never both', async () => {
    const ownerAvailability = new OwnerAvailabilityService(prisma);
    const locks = new AvailabilitySlotLockService();
    const professionals = new ProfessionalAccessService(prisma);
    const holds = new SlotHoldsService(prisma, new AvailabilityConfigService({ get: () => '600' } as never), locks, professionals);
    const bookings = new BookingsService(prisma, locks, professionals);
    const localDate = '2099-12-19';
    await ownerAvailability.openFixedSlots(salonId, workspaceId, userId, { localDate, periods: ['09:00-11:00'] }, `expiry-open-${suffix}`);
    const slot = await prisma.availabilitySlot.findFirstOrThrow({ where: { workspaceId, localDate: new Date(`${localDate}T00:00:00.000Z`) } });
    const held = await holds.create(professionalAId, slot.id, `expiry-hold-${suffix}`);

    await Promise.allSettled([
      holds.expireBatch(10, new Date(held.hold.expiresAt)),
      bookings.confirm(professionalAId, held.hold.id, `expiry-confirm-${suffix}`)
    ]);

    const savedSlot = await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } });
    const bookingCount = await prisma.booking.count({ where: { availabilitySlotId: slot.id } });
    const holdCount = await prisma.slotHold.count({ where: { availabilitySlotId: slot.id } });
    expect(holdCount).toBe(0);
    expect([AvailabilitySlotStatus.OPEN, AvailabilitySlotStatus.BOOKED]).toContain(savedSlot.status);
    expect(bookingCount).toBe(savedSlot.status === AvailabilitySlotStatus.BOOKED ? 1 : 0);
  }, 30_000);
});
