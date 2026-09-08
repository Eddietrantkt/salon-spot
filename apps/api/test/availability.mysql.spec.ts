import { AvailabilitySlotStatus, MediaStatus, MembershipRole, OutboxStatus, ProfessionalProfileStatus, WorkspaceStatus } from '@prisma/client';
import { FIXED_SLOT_PERIODS } from '@salon-spot/contracts';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';
import { OwnerAvailabilityService } from '../src/modules/availability/application/owner-availability.service.js';
import { AvailabilityConfigService } from '../src/modules/availability/application/availability-config.service.js';
import { AvailabilitySlotLockService } from '../src/modules/availability/application/availability-slot-lock.service.js';
import { SlotHoldsService } from '../src/modules/availability/application/slot-holds.service.js';
import { BookingsService } from '../src/modules/bookings/application/bookings.service.js';
import { ProfessionalAccessService } from '../src/modules/professionals/application/professional-access.service.js';
import { NotificationOutboxProcessor } from '../src/modules/notifications/application/notification-outbox.processor.js';
import { MediaCleanupService } from '../src/modules/media/application/media-cleanup.service.js';
import { OwnerMediaService } from '../src/modules/media/application/owner-media.service.js';

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
    const bookingIds = (await prisma.booking.findMany({ where: { slot: { workspaceId } }, select: { id: true } })).map((booking) => booking.id);
    const relatedOutboxIds = (await prisma.outboxEvent.findMany()).filter((event) => {
      const payload = JSON.stringify(event.payload);
      return payload.includes(suffix) || bookingIds.some((bookingId) => payload.includes(bookingId));
    }).map((event) => event.id);
    if (relatedOutboxIds.length > 0) await prisma.outboxEvent.deleteMany({ where: { id: { in: relatedOutboxIds } } });
    await prisma.idempotencyRecord.deleteMany({ where: { actorUserId: { in: [userId, professionalAId, professionalBId] } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: workspaceId } });
    await prisma.booking.deleteMany({ where: { slot: { workspaceId } } });
    await prisma.slotHold.deleteMany({ where: { slot: { workspaceId } } });
    await prisma.workspace.update({ where: { id: workspaceId }, data: { coverMediaId: null } });
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

  it('returns one canonical booking when the same hold is confirmed concurrently', async () => {
    const ownerAvailability = new OwnerAvailabilityService(prisma);
    const locks = new AvailabilitySlotLockService();
    const professionals = new ProfessionalAccessService(prisma);
    const holds = new SlotHoldsService(prisma, new AvailabilityConfigService({ get: () => '600' } as never), locks, professionals);
    const bookings = new BookingsService(prisma, locks, professionals);
    const localDate = '2099-12-20';
    await ownerAvailability.openFixedSlots(salonId, workspaceId, userId, { localDate, periods: ['09:00-11:00'] }, `confirm-race-open-${suffix}`);
    const slot = await prisma.availabilitySlot.findFirstOrThrow({ where: { workspaceId, localDate: new Date(`${localDate}T00:00:00.000Z`) } });
    const held = await holds.create(professionalAId, slot.id, `confirm-race-hold-${suffix}`);
    const results = await Promise.all([bookings.confirm(professionalAId, held.hold.id, `confirm-race-${suffix}`), bookings.confirm(professionalAId, held.hold.id, `confirm-race-${suffix}`)]);
    expect(new Set(results.map((result) => result.booking.id))).toEqual(new Set([results[0]!.booking.id]));
    await expect(prisma.booking.count({ where: { availabilitySlotId: slot.id } })).resolves.toBe(1);
    await expect(prisma.slotHold.count({ where: { availabilitySlotId: slot.id } })).resolves.toBe(0);
    await expect(prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } })).resolves.toMatchObject({ status: AvailabilitySlotStatus.BOOKED });
    await expect(prisma.auditEvent.count({ where: { entityType: 'Booking', entityId: results[0]!.booking.id, action: 'BOOKING_CONFIRMED' } })).resolves.toBe(1);
    const events = await prisma.outboxEvent.findMany({ where: { topic: 'BOOKING_CONFIRMED' } });
    expect(events.filter((event) => (event.payload as { bookingId?: string }).bookingId === results[0]!.booking.id)).toHaveLength(1);
  }, 30_000);

  it('returns one canonical cancellation without duplicate audit or outbox records', async () => {
    const ownerAvailability = new OwnerAvailabilityService(prisma);
    const locks = new AvailabilitySlotLockService();
    const professionals = new ProfessionalAccessService(prisma);
    const holds = new SlotHoldsService(prisma, new AvailabilityConfigService({ get: () => '600' } as never), locks, professionals);
    const bookings = new BookingsService(prisma, locks, professionals);
    const localDate = '2099-12-21';
    await ownerAvailability.openFixedSlots(salonId, workspaceId, userId, { localDate, periods: ['09:00-11:00'] }, `cancel-race-open-${suffix}`);
    const slot = await prisma.availabilitySlot.findFirstOrThrow({ where: { workspaceId, localDate: new Date(`${localDate}T00:00:00.000Z`) } });
    const held = await holds.create(professionalAId, slot.id, `cancel-race-hold-${suffix}`);
    const confirmed = await bookings.confirm(professionalAId, held.hold.id, `cancel-race-confirm-${suffix}`);
    const results = await Promise.all([bookings.cancel(professionalAId, confirmed.booking.id, `cancel-race-${suffix}`), bookings.cancel(professionalAId, confirmed.booking.id, `cancel-race-${suffix}`)]);
    expect(new Set(results.map((result) => result.booking.id))).toEqual(new Set([confirmed.booking.id]));
    await expect(prisma.booking.findUniqueOrThrow({ where: { id: confirmed.booking.id } })).resolves.toMatchObject({ status: 'CANCELLED' });
    await expect(prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } })).resolves.toMatchObject({ status: AvailabilitySlotStatus.OPEN });
    await expect(prisma.auditEvent.count({ where: { entityType: 'Booking', entityId: confirmed.booking.id, action: 'BOOKING_CANCELLED' } })).resolves.toBe(1);
    const events = await prisma.outboxEvent.findMany({ where: { topic: 'BOOKING_CANCELLED' } });
    expect(events.filter((event) => (event.payload as { bookingId?: string }).bookingId === confirmed.booking.id)).toHaveLength(1);
  }, 30_000);

  it('reclaims one expired notification lease and materializes recipients without duplicates', async () => {
    const booking = await prisma.booking.findFirstOrThrow({ where: { professionalUserId: professionalAId }, orderBy: { createdAt: 'asc' } });
    const events = await prisma.outboxEvent.findMany({ where: { topic: 'BOOKING_CONFIRMED' } });
    const event = events.find((candidate) => (candidate.payload as { bookingId?: string }).bookingId === booking.id);
    if (!event) throw new Error('Expected a booking confirmation outbox event from the earlier concurrency case.');
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { status: OutboxStatus.PROCESSING, attempts: 1, availableAt: new Date(Date.now() - 1_000) } });
    const processor = new NotificationOutboxProcessor(prisma);
    await expect(processor.processBatch()).resolves.toBeGreaterThanOrEqual(1);
    await expect(prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).resolves.toMatchObject({ status: OutboxStatus.DELIVERED, attempts: 2 });
    await expect(prisma.notification.count({ where: { sourceEventId: event.id } })).resolves.toBe(2);

    await prisma.outboxEvent.update({ where: { id: event.id }, data: { status: OutboxStatus.PROCESSING, availableAt: new Date(Date.now() - 1_000) } });
    await expect(processor.processBatch()).resolves.toBeGreaterThanOrEqual(1);
    await expect(prisma.notification.count({ where: { sourceEventId: event.id } })).resolves.toBe(2);
    await expect(prisma.notificationDelivery.count({ where: { notification: { sourceEventId: event.id } } })).resolves.toBe(2);
  }, 30_000);

  it('materializes all supported booking event types once under concurrent processors', async () => {
    const booking = await prisma.booking.findFirstOrThrow({ where: { professionalUserId: professionalAId } });
    const topics = ['BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED'];
    const events = await Promise.all(topics.map((topic) => prisma.outboxEvent.create({
      data: { topic, payload: { bookingId: booking.id } }
    })));
    const processor = new NotificationOutboxProcessor(prisma);
    await Promise.all([processor.processBatch(), processor.processBatch()]);
    for (const event of events) {
      const notifications = await prisma.notification.findMany({ where: { sourceEventId: event.id }, include: { deliveries: true } });
      expect(notifications).toHaveLength(2);
      expect(new Set(notifications.map((item) => item.recipientUserId))).toEqual(new Set([userId, professionalAId]));
      for (const item of notifications) {
        expect(item.type).toBe(event.topic);
        expect(item.deliveries).toHaveLength(1);
        expect(item.deliveries[0]).toMatchObject({ channel: 'IN_APP', status: 'DELIVERED' });
      }
      expect(await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ status: 'DELIVERED' });
    }
  }, 30_000);

  it('serializes concurrent media upload intents at the active-media cap', async () => {
    let sequence = 0;
    const storage = {
      createUpload: () => ({ storageKey: `staging/salons/${salonId}/cap-${suffix}-${sequence++}.png`, url: 'http://upload.invalid', expiresAt: new Date(Date.now() + 60_000) })
    };
    const media = new OwnerMediaService(prisma, storage as never, { publicBaseUrl: 'http://localhost/api/v1', maxUploadBytes: 10_000_000 } as never);
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => media.createSalonUploadIntent(salonId, userId, { contentType: 'image/png' } )));
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(10);
    await expect(prisma.salonMedia.count({ where: { salonId, status: { in: [MediaStatus.PENDING_UPLOAD, MediaStatus.PROCESSING, MediaStatus.READY, MediaStatus.DELETE_PENDING] } } })).resolves.toBe(10);
  }, 30_000);

  it('marks delete pending media DELETED only after cleanup succeeds and preserves another cover', async () => {
    const coverId = `cover-${suffix}`;
    const targetId = `cleanup-${suffix}`;
    await prisma.workspaceMedia.createMany({ data: [
      { id: coverId, workspaceId, storageKey: `ready/workspaces/${workspaceId}/cover-${suffix}.png`, contentType: 'image/png', status: MediaStatus.READY, sortOrder: 0 },
      { id: targetId, workspaceId, storageKey: `ready/workspaces/${workspaceId}/target-${suffix}.png`, contentType: 'image/png', status: MediaStatus.DELETE_PENDING, sortOrder: 1 }
    ] });
    await prisma.workspace.update({ where: { id: workspaceId }, data: { coverMediaId: coverId } });
    const event = await prisma.outboxEvent.create({ data: { topic: 'MEDIA_DELETE_REQUESTED', payload: { kind: 'workspace', mediaId: targetId, storageKey: `ready/workspaces/${workspaceId}/target-${suffix}.png` } } });
    let deletes = 0;
    const storage = { delete: async () => { deletes += 1; if (deletes === 1) throw new Error('transient storage failure'); } };
    const cleanup = new MediaCleanupService(prisma, storage as never);
    await expect(cleanup.processBatch()).resolves.toBe(0);
    await expect(prisma.workspaceMedia.findUniqueOrThrow({ where: { id: targetId } })).resolves.toMatchObject({ status: MediaStatus.DELETE_PENDING });
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { availableAt: new Date(Date.now() - 1_000) } });
    await expect(cleanup.processBatch()).resolves.toBe(1);
    await expect(prisma.workspaceMedia.findUniqueOrThrow({ where: { id: targetId } })).resolves.toMatchObject({ status: MediaStatus.DELETED });
    await expect(prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).resolves.toMatchObject({ coverMediaId: coverId });
  }, 30_000);
});
