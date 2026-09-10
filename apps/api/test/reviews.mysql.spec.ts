import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { AvailabilitySlotStatus, BookingStatus, ProfessionalProfileStatus, WorkspaceStatus } from '@prisma/client';
import { API_PREFIX } from '@salon-spot/contracts';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';
import { AccessTokenService } from '../src/modules/auth/application/access-token.service.js';

const describeMySql = process.env.RUN_MYSQL_E2E === '1' ? describe : describe.skip;

describeMySql('Salon reviews over HTTP on MySQL', () => {
  const suffix = `${Date.now()}`;
  const professional = `rvpa${suffix}`;
  const otherProfessional = `rvpb${suffix}`;
  const salon = `rvsa${suffix}`;
  const workspace = `rvwa${suffix}`;
  const option = `rvro${suffix}`;
  const completedSlot = `rvsc${suffix}`;
  const confirmedSlot = `rvsf${suffix}`;
  const raceSlot = `rvsr${suffix}`;
  const completedBooking = `rvbc${suffix}`;
  const confirmedBooking = `rvbf${suffix}`;
  const raceBooking = `rvbr${suffix}`;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let prisma: PrismaService;
  let accessTokens: AccessTokenService;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/${API_PREFIX}`;
    prisma = app.get(PrismaService);
    accessTokens = app.get(AccessTokenService);

    await prisma.user.createMany({ data: [
      { id: professional, email: `review-pro-${suffix}@example.test`, displayName: 'Mai Reviewer', passwordHash: 'fixture-only' },
      { id: otherProfessional, email: `review-other-${suffix}@example.test`, displayName: 'Other Reviewer', passwordHash: 'fixture-only' }
    ] });
    await prisma.professionalProfile.createMany({ data: [
      { userId: professional, status: ProfessionalProfileStatus.ACTIVE },
      { userId: otherProfessional, status: ProfessionalProfileStatus.ACTIVE }
    ] });
    await prisma.salon.create({ data: { id: salon, name: 'Review Salon', area: 'District 1', timezone: 'Asia/Ho_Chi_Minh' } });
    await prisma.workspace.create({ data: { id: workspace, salonId: salon, name: 'Review Chair', status: WorkspaceStatus.PUBLISHED } });
    await prisma.rentalOption.create({ data: { id: option, workspaceId: workspace, label: '2 hours', priceCents: 250_000 } });
    await prisma.availabilitySlot.createMany({ data: [
      { id: completedSlot, workspaceId: workspace, rentalOptionId: option, localDate: new Date('2026-08-01T00:00:00.000Z'), startsAt: new Date('2026-08-01T02:00:00.000Z'), endsAt: new Date('2026-08-01T04:00:00.000Z'), status: AvailabilitySlotStatus.BOOKED },
      { id: confirmedSlot, workspaceId: workspace, rentalOptionId: option, localDate: new Date('2099-08-02T00:00:00.000Z'), startsAt: new Date('2099-08-02T02:00:00.000Z'), endsAt: new Date('2099-08-02T04:00:00.000Z'), status: AvailabilitySlotStatus.BOOKED },
      { id: raceSlot, workspaceId: workspace, rentalOptionId: option, localDate: new Date('2026-08-03T00:00:00.000Z'), startsAt: new Date('2026-08-03T02:00:00.000Z'), endsAt: new Date('2026-08-03T04:00:00.000Z'), status: AvailabilitySlotStatus.BOOKED }
    ] });
    await prisma.booking.createMany({ data: [
      { id: completedBooking, availabilitySlotId: completedSlot, professionalUserId: professional, status: BookingStatus.COMPLETED, workspaceName: 'Review Chair', rentalOptionLabel: '2 hours', priceCents: 250_000, startsAt: new Date('2026-08-01T02:00:00.000Z'), endsAt: new Date('2026-08-01T04:00:00.000Z'), salonTimezone: 'Asia/Ho_Chi_Minh', localDate: new Date('2026-08-01T00:00:00.000Z'), completedAt: new Date('2026-08-01T04:00:00.000Z') },
      { id: confirmedBooking, availabilitySlotId: confirmedSlot, professionalUserId: professional, status: BookingStatus.CONFIRMED, workspaceName: 'Review Chair', rentalOptionLabel: '2 hours', priceCents: 250_000, startsAt: new Date('2099-08-02T02:00:00.000Z'), endsAt: new Date('2099-08-02T04:00:00.000Z'), salonTimezone: 'Asia/Ho_Chi_Minh', localDate: new Date('2099-08-02T00:00:00.000Z') },
      { id: raceBooking, availabilitySlotId: raceSlot, professionalUserId: professional, status: BookingStatus.COMPLETED, workspaceName: 'Review Chair', rentalOptionLabel: '2 hours', priceCents: 250_000, startsAt: new Date('2026-08-03T02:00:00.000Z'), endsAt: new Date('2026-08-03T04:00:00.000Z'), salonTimezone: 'Asia/Ho_Chi_Minh', localDate: new Date('2026-08-03T00:00:00.000Z'), completedAt: new Date('2026-08-03T04:00:00.000Z') }
    ] });
  }, 30_000);

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { salonId: salon } });
    await prisma.idempotencyRecord.deleteMany({ where: { actorUserId: { in: [professional, otherProfessional] } } });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: [professional, otherProfessional] } } });
    await prisma.booking.deleteMany({ where: { id: { in: [completedBooking, confirmedBooking, raceBooking] } } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: [completedSlot, confirmedSlot, raceSlot] } } });
    await prisma.workspace.deleteMany({ where: { id: workspace } });
    await prisma.salon.deleteMany({ where: { id: salon } });
    await prisma.user.deleteMany({ where: { id: { in: [professional, otherProfessional] } } });
    await app.close();
  });

  function authorization(userId: string, emailPrefix: string): Record<string, string> {
    return { authorization: `Bearer ${accessTokens.issue({ sub: userId, email: `${emailPrefix}-${suffix}@example.test` }).token}` };
  }

  it('publishes only a verified review from the Professional who completed the booking', async () => {
    const empty = await fetch(`${baseUrl}/salons/${salon}/reviews`);
    expect(empty.status).toBe(200);
    await expect(empty.json()).resolves.toMatchObject({ data: [], summary: { averageRating: null, reviewCount: 0 } });

    const wrongOwner = await fetch(`${baseUrl}/bookings/${completedBooking}/reviews`, {
      method: 'POST',
      headers: { ...authorization(otherProfessional, 'review-other'), 'content-type': 'application/json', 'idempotency-key': 'wrong-review' },
      body: JSON.stringify({ rating: 5, body: 'Should not be accepted.' })
    });
    expect(wrongOwner.status).toBe(404);

    const notCompleted = await fetch(`${baseUrl}/bookings/${confirmedBooking}/reviews`, {
      method: 'POST',
      headers: { ...authorization(professional, 'review-pro'), 'content-type': 'application/json', 'idempotency-key': 'early-review' },
      body: JSON.stringify({ rating: 5, body: 'Too early.' })
    });
    expect(notCompleted.status).toBe(409);
    await expect(notCompleted.json()).resolves.toMatchObject({ code: 'REVIEW_NOT_ELIGIBLE' });

    const headers = { ...authorization(professional, 'review-pro'), 'content-type': 'application/json', 'idempotency-key': 'publish-review' };
    const created = await fetch(`${baseUrl}/bookings/${completedBooking}/reviews`, {
      method: 'POST', headers, body: JSON.stringify({ rating: 5, body: 'Clean, friendly salon.' })
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { review: { id: string } };
    expect(createdBody.review).toMatchObject({ salonId: salon, authorDisplayName: 'Mai Reviewer', rating: 5, body: 'Clean, friendly salon.', verifiedRental: true });
    expect(createdBody.review).not.toHaveProperty('bookingId');

    const replay = await fetch(`${baseUrl}/bookings/${completedBooking}/reviews`, {
      method: 'POST', headers, body: JSON.stringify({ rating: 5, body: 'Clean, friendly salon.' })
    });
    expect(replay.status).toBe(201);
    await expect(replay.json()).resolves.toEqual(createdBody);

    const duplicate = await fetch(`${baseUrl}/bookings/${completedBooking}/reviews`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'second-review' },
      body: JSON.stringify({ rating: 4, body: 'Changed my mind.' })
    });
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toMatchObject({ code: 'REVIEW_ALREADY_EXISTS' });

    const list = await fetch(`${baseUrl}/salons/${salon}/reviews?page=1&pageSize=10`);
    expect(list.status).toBe(200);
    const listBody = await list.json() as Record<string, unknown>;
    expect(listBody).toMatchObject({
      data: [{ id: createdBody.review.id, salonId: salon, authorDisplayName: 'Mai Reviewer', rating: 5, body: 'Clean, friendly salon.', verifiedRental: true }],
      meta: { page: 1, pageSize: 10, total: 1 },
      summary: { averageRating: 5, reviewCount: 1 }
    });
    expect(JSON.stringify(listBody)).not.toContain(completedBooking);

    const mine = await fetch(`${baseUrl}/me/bookings`, { headers: authorization(professional, 'review-pro') });
    expect(mine.status).toBe(200);
    const mineBody = await mine.json() as { bookings: Array<{ id: string; reviewId: string | null }> };
    expect(mineBody.bookings.find((booking) => booking.id === completedBooking)?.reviewId).toBe(createdBody.review.id);
    expect(mineBody.bookings.find((booking) => booking.id === confirmedBooking)?.reviewId).toBeNull();

    const concurrentHeaders = authorization(professional, 'review-pro');
    const concurrent = await Promise.all(['race-a', 'race-b'].map((key) => fetch(`${baseUrl}/bookings/${raceBooking}/reviews`, {
      method: 'POST',
      headers: { ...concurrentHeaders, 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify({ rating: 4, body: 'Concurrent submission.' })
    })));
    expect(concurrent.map((response) => response.status).sort()).toEqual([201, 409]);
    await expect(prisma.review.count({ where: { bookingId: raceBooking } })).resolves.toBe(1);
  });

  it('rejects invalid ratings and unknown salons', async () => {
    const invalid = await fetch(`${baseUrl}/bookings/${completedBooking}/reviews`, {
      method: 'POST',
      headers: { ...authorization(professional, 'review-pro'), 'content-type': 'application/json', 'idempotency-key': 'invalid-review' },
      body: JSON.stringify({ rating: 6 })
    });
    expect(invalid.status).toBe(400);

    const missing = await fetch(`${baseUrl}/salons/missing-salon/reviews`);
    expect(missing.status).toBe(404);
  });
});
