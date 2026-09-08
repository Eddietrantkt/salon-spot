import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { AvailabilitySlotStatus, MembershipRole, ProfessionalProfileStatus, UserStatus, WorkspaceStatus } from '@prisma/client';
import { API_PREFIX } from '@salon-spot/contracts';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/database/prisma/prisma.service.js';
import { AccessTokenService } from '../src/modules/auth/application/access-token.service.js';
import { AuthConfigService } from '../src/modules/auth/application/auth-config.service.js';

const describeMySql = process.env.RUN_MYSQL_E2E === '1' ? describe : describe.skip;

describeMySql('P1 HTTP BOLA and session revocation on MySQL', () => {
  const suffix = `${Date.now()}`;
  const ownerA = `p1oa${suffix}`;
  const ownerB = `p1ob${suffix}`;
  const activeProfessional = `p1pa${suffix}`;
  const pendingProfessional = `p1pp${suffix}`;
  const admin = `p1ad${suffix}`;
  const salonA = `p1sa${suffix}`;
  const salonB = `p1sb${suffix}`;
  const workspaceB = `p1wb${suffix}`;
  const optionB = `p1ro${suffix}`;
  const slotB = `p1sl${suffix}`;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let prisma: PrismaService;
  let baseUrl: string;
  let accessTokens: AccessTokenService;
  let authConfig: AuthConfigService;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/${API_PREFIX}`;
    prisma = app.get(PrismaService);
    accessTokens = app.get(AccessTokenService);
    authConfig = app.get(AuthConfigService);
    const localDate = new Date('2099-12-21T00:00:00.000Z');
    await prisma.user.createMany({ data: [
      { id: ownerA, email: `p1-owner-a-${suffix}@example.test`, displayName: 'P1 Owner A', passwordHash: 'fixture-only' },
      { id: ownerB, email: `p1-owner-b-${suffix}@example.test`, displayName: 'P1 Owner B', passwordHash: 'fixture-only' },
      { id: activeProfessional, email: `p1-active-${suffix}@example.test`, displayName: 'P1 Active Professional', passwordHash: 'fixture-only' },
      { id: pendingProfessional, email: `p1-pending-${suffix}@example.test`, displayName: 'P1 Pending Professional', passwordHash: 'fixture-only' },
      { id: admin, email: `p1-admin-${suffix}@example.test`, displayName: 'P1 Admin', passwordHash: 'fixture-only' }
    ] });
    await prisma.professionalProfile.createMany({ data: [
      { userId: activeProfessional, status: ProfessionalProfileStatus.ACTIVE },
      { userId: pendingProfessional, status: ProfessionalProfileStatus.PENDING }
    ] });
    await prisma.adminAccess.create({ data: { userId: admin } });
    await prisma.salon.createMany({ data: [
      { id: salonA, name: 'P1 Salon A', area: 'A', timezone: 'Asia/Ho_Chi_Minh' },
      { id: salonB, name: 'P1 Salon B', area: 'B', timezone: 'America/Los_Angeles' }
    ] });
    await prisma.salonMembership.createMany({ data: [
      { salonId: salonA, userId: ownerA, role: MembershipRole.OWNER },
      { salonId: salonB, userId: ownerB, role: MembershipRole.OWNER }
    ] });
    await prisma.workspace.create({ data: { id: workspaceB, salonId: salonB, name: 'P1 Workspace B', status: WorkspaceStatus.PUBLISHED } });
    await prisma.rentalOption.create({ data: { id: optionB, workspaceId: workspaceB, label: '2 hours', priceCents: 250000 } });
    await prisma.workspaceCalendarLock.create({ data: { workspaceId: workspaceB, localDate } });
    await prisma.availabilitySlot.create({ data: { id: slotB, workspaceId: workspaceB, rentalOptionId: optionB, localDate, startsAt: new Date('2099-12-21T17:00:00.000Z'), endsAt: new Date('2099-12-21T19:00:00.000Z'), status: AvailabilitySlotStatus.OPEN } });
  }, 30_000);

  afterAll(async () => {
    await prisma.idempotencyRecord.deleteMany({ where: { actorUserId: { in: [ownerA, ownerB, activeProfessional, pendingProfessional, admin] } } });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: [ownerA, ownerB, activeProfessional, pendingProfessional, admin] } } });
    await prisma.booking.deleteMany({ where: { professionalUserId: { in: [activeProfessional, pendingProfessional] } } });
    await prisma.slotHold.deleteMany({ where: { professionalUserId: { in: [activeProfessional, pendingProfessional] } } });
    await prisma.availabilitySlot.deleteMany({ where: { workspaceId: workspaceB } });
    await prisma.workspaceCalendarLock.deleteMany({ where: { workspaceId: workspaceB } });
    await prisma.workspace.deleteMany({ where: { id: workspaceB } });
    await prisma.salon.deleteMany({ where: { id: { in: [salonA, salonB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerA, ownerB, activeProfessional, pendingProfessional, admin] } } });
    await app.close();
  });

  function authorization(userId: string, email: string): Record<string, string> {
    return { authorization: `Bearer ${accessTokens.issue({ sub: userId, email }).token}` };
  }

  it('denies cross-Salon writes over HTTP for Owner, Admin and Professional without DB mutation', async () => {
    const before = await prisma.workspace.count({ where: { salonId: salonB } });
    const body = { name: 'Forbidden workspace', rentalLabel: '2 hours', priceCents: 250000 };
    for (const [userId, email] of [[ownerA, `p1-owner-a-${suffix}@example.test`], [admin, `p1-admin-${suffix}@example.test`], [activeProfessional, `p1-active-${suffix}@example.test`]] as const) {
      const response = await fetch(`${baseUrl}/owner/salons/${salonB}/workspaces`, { method: 'POST', headers: { ...authorization(userId, email), 'content-type': 'application/json', 'idempotency-key': `foreign-${userId}` }, body: JSON.stringify(body) });
      expect(response.status).toBe(403);
      expect(response.headers.get('x-request-id')).toBeTruthy();
    }
    await expect(prisma.workspace.count({ where: { salonId: salonB } })).resolves.toBe(before);
  });

  it('allows only an ACTIVE Professional to hold and exposes its booking detail only to the Professional and Salon Owner', async () => {
    const pending = await fetch(`${baseUrl}/availability/slots/${slotB}/holds`, { method: 'POST', headers: { ...authorization(pendingProfessional, `p1-pending-${suffix}@example.test`), 'idempotency-key': 'pending-hold' } });
    expect(pending.status).toBe(403);
    await expect(prisma.slotHold.count({ where: { availabilitySlotId: slotB } })).resolves.toBe(0);

    const active = await fetch(`${baseUrl}/availability/slots/${slotB}/holds`, { method: 'POST', headers: { ...authorization(activeProfessional, `p1-active-${suffix}@example.test`), 'idempotency-key': 'active-hold' } });
    expect(active.status).toBe(201);
    await expect(prisma.slotHold.count({ where: { availabilitySlotId: slotB, professionalUserId: activeProfessional } })).resolves.toBe(1);
    const hold = (await active.json() as { hold: { id: string } }).hold;
    const confirmed = await fetch(`${baseUrl}/holds/${hold.id}/confirm`, { method: 'POST', headers: { ...authorization(activeProfessional, `p1-active-${suffix}@example.test`), 'idempotency-key': 'active-confirm' } });
    expect(confirmed.status).toBe(201);
    const bookingId = (await confirmed.json() as { booking: { id: string } }).booking.id;

    const professionalDetail = await fetch(`${baseUrl}/me/bookings/${bookingId}`, { headers: authorization(activeProfessional, `p1-active-${suffix}@example.test`) });
    expect(professionalDetail.status).toBe(200);
    await expect(professionalDetail.json()).resolves.toMatchObject({ booking: { id: bookingId }, viewerCanCancel: true });
    const ownerDetail = await fetch(`${baseUrl}/me/bookings/${bookingId}`, { headers: authorization(ownerB, `p1-owner-b-${suffix}@example.test`) });
    expect(ownerDetail.status).toBe(200);
    await expect(ownerDetail.json()).resolves.toMatchObject({ booking: { id: bookingId }, viewerCanCancel: false });
    const unrelatedOwner = await fetch(`${baseUrl}/me/bookings/${bookingId}`, { headers: authorization(ownerA, `p1-owner-a-${suffix}@example.test`) });
    expect(unrelatedOwner.status).toBe(404);
  });

  it('suspends access and refresh sessions, and reactivation does not restore the old refresh session', async () => {
    const rawRefresh = `p1-refresh-${suffix}`;
    await prisma.authSession.create({ data: { userId: ownerA, refreshTokenHash: authConfig.hashRefreshToken(rawRefresh), familyId: `p1-family-${suffix}`, expiresAt: new Date('2099-12-30T00:00:00.000Z') } });
    const suspend = await fetch(`${baseUrl}/admin/users/${ownerA}/status`, { method: 'PUT', headers: { ...authorization(admin, `p1-admin-${suffix}@example.test`), 'content-type': 'application/json', 'idempotency-key': 'suspend-owner-a' }, body: JSON.stringify({ status: UserStatus.SUSPENDED, reason: 'P1 session revocation test' }) });
    expect(suspend.status).toBe(200);
    const oldAccess = await fetch(`${baseUrl}/owner/salons`, { headers: authorization(ownerA, `p1-owner-a-${suffix}@example.test`) });
    expect(oldAccess.status).toBe(401);
    const oldRefresh = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { cookie: `salon_spot_refresh=${rawRefresh}` } });
    expect(oldRefresh.status).toBe(401);

    const reactivate = await fetch(`${baseUrl}/admin/users/${ownerA}/status`, { method: 'PUT', headers: { ...authorization(admin, `p1-admin-${suffix}@example.test`), 'content-type': 'application/json', 'idempotency-key': 'reactivate-owner-a' }, body: JSON.stringify({ status: UserStatus.ACTIVE, reason: 'P1 session revocation test complete' }) });
    expect(reactivate.status).toBe(200);
    const replayedRefresh = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { cookie: `salon_spot_refresh=${rawRefresh}` } });
    expect(replayedRefresh.status).toBe(401);
    await expect(prisma.authSession.count({ where: { userId: ownerA, revokedAt: null } })).resolves.toBe(0);
  });
});
