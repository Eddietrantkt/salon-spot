import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Only run against the dedicated disposable QA database and a locally started API/web.
const database = new URL(process.env.DATABASE_URL ?? 'http://invalid');
if (database.pathname !== '/notification_qa' || !['127.0.0.1', 'localhost'].includes(database.hostname)) {
  throw new Error('DATABASE_URL must target the local disposable notification_qa database.');
}
const baseUrl = process.env.NOTIFICATION_QA_BASE_URL;
if (!baseUrl || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) throw new Error('Set a local NOTIFICATION_QA_BASE_URL.');
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { PrismaClient } = requireApi('@prisma/client');
const prisma = new PrismaClient();
const artifactDir = resolve('artifacts/notification-qa', `${Date.now()}`);
await mkdir(artifactDir, { recursive: true });
const report = { checks: [], findings: [], artifactDir };
const browser = await chromium.launch({ headless: true });
let userId;
let salonId;
let workspaceId;
let bookingId;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await context.request.post(`${baseUrl}/api/v1/auth/register`, { data: {
    email: `browser-notify-${Date.now()}@example.test`, displayName: 'Notification QA', password: 'Disposable-QA-only-123!'
  } });
  expect(response.status()).toBe(201);
  userId = (await response.json()).user.id;
  await prisma.professionalProfile.create({ data: { userId, status: 'ACTIVE' } });
  const salon = await prisma.salon.create({ data: { name: 'Notification QA Salon', area: 'D1', timezone: 'Asia/Ho_Chi_Minh' } });
  salonId = salon.id;
  const workspace = await prisma.workspace.create({ data: { salonId, name: 'Notification QA Workspace', status: 'PUBLISHED' } });
  workspaceId = workspace.id;
  const rental = await prisma.rentalOption.create({ data: { workspaceId, label: 'QA session', priceCents: 250000 } });
  const slot = await prisma.availabilitySlot.create({ data: {
    workspaceId, rentalOptionId: rental.id, localDate: new Date('2099-12-20T00:00:00.000Z'),
    startsAt: new Date('2099-12-20T02:00:00.000Z'), endsAt: new Date('2099-12-20T04:00:00.000Z'), status: 'BOOKED'
  } });
  const booking = await prisma.booking.create({ data: {
    availabilitySlotId: slot.id, professionalUserId: userId, workspaceName: workspace.name,
    rentalOptionLabel: rental.label, priceCents: rental.priceCents,
    startsAt: slot.startsAt, endsAt: slot.endsAt, salonTimezone: salon.timezone, localDate: slot.localDate
  } });
  bookingId = booking.id;
  const fixtures = Array.from({ length: 51 }, (_, index) => ({
    recipientUserId: userId, sourceEventId: `qa-${Date.now()}-${index}`, type: 'BOOKING_CONFIRMED',
    titleKey: 'notifications.bookingConfirmed.title', bodyKey: 'notifications.bookingConfirmed.body',
    payload: { bookingId, workspaceName: `QA Workspace ${index}`, localDate: '2099-12-20', recipientRole: 'PROFESSIONAL' },
    entityType: 'Booking', entityId: bookingId, createdAt: new Date(Date.now() + index * 1000)
  }));
  await prisma.notification.createMany({ data: fixtures });
  await page.goto(`${baseUrl}/notifications`);
  await expect(page.locator('.notification-card')).toHaveCount(50);
  await expect(page.locator('.app-nav a[href="/notifications"]')).toHaveText('Notifications (51)');
  report.checks.push('Real refresh-cookie session restores; inbox and unread badge load from MySQL.');
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.locator('.notification-card')).toHaveCount(51);
  report.checks.push('Load more exposes notification 51 without duplicates.');
  await page.screenshot({ path: resolve(artifactDir, 'desktop.png') });

  await page.getByRole('button', { name: 'Unread', exact: true }).click();
  await expect(page.locator('.notification-card')).toHaveCount(50);
  const markedRead = page.waitForResponse((response) => response.url().includes('/notifications/') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Mark read', exact: true }).first().click();
  expect((await markedRead).status()).toBe(200);
  await expect(page.locator('.notification-card')).toHaveCount(49);
  expect(await prisma.notification.count({ where: { recipientUserId: userId, readAt: { not: null } } })).toBe(1);
  await page.getByRole('button', { name: 'Read', exact: true }).click();
  await expect(page.locator('.notification-card')).toHaveCount(1);
  report.checks.push('Mark-read persists in DB and read/unread filters update.');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.notification-card')).toHaveCount(50);
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
  await expect(page.locator('.notification-unread')).toHaveCount(0);
  expect(await prisma.notification.count({ where: { recipientUserId: userId, readAt: null } })).toBe(0);
  report.checks.push('Mark-all-read persists for all 51 records, including the item outside the visible page.');

  await page.locator('.notification-preferences select').selectOption('VI');
  await page.getByLabel('Email delivery', { exact: true }).uncheck();
  const saved = page.waitForResponse((r) => r.url().includes('/notification-preferences') && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  expect((await saved).status()).toBe(200);
  expect(await prisma.notificationPreference.findUnique({ where: { userId } })).toMatchObject({ locale: 'VI', emailEnabled: false });
  await page.reload();
  await expect(page.locator('.notification-preferences select')).toHaveValue('VI');
  await expect(page.getByLabel('Email delivery', { exact: true })).not.toBeChecked();
  report.checks.push('Preferences persist across page reload through real API and DB.');
  await page.getByRole('button', { name: 'VI', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thông báo');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: resolve(artifactDir, 'mobile-vi.png'), fullPage: true });
  report.checks.push('Vietnamese UI and 390px mobile viewport have no horizontal overflow.');
  await page.getByRole('button', { name: 'Mở lịch đặt', exact: true }).first().click();
  await expect(page).toHaveURL(`${baseUrl}/bookings?bookingId=${bookingId}`);
  await expect(page.locator(`[data-booking-id="${bookingId}"]`)).toHaveCount(1);
  expect(errors).toEqual([]);
  report.checks.push('Professional notification navigates to bookings; no uncaught browser errors.');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  if (userId) {
    await prisma.idempotencyRecord.deleteMany({ where: { actorUserId: userId } });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: userId } });
    await prisma.booking.deleteMany({ where: { professionalUserId: userId } });
    if (workspaceId) {
      await prisma.availabilitySlot.deleteMany({ where: { workspaceId } });
      await prisma.workspace.delete({ where: { id: workspaceId } });
    }
    if (salonId) await prisma.salon.delete({ where: { id: salonId } });
    await prisma.user.delete({ where: { id: userId } });
  }
  await prisma.$disconnect();
  await writeFile(resolve(artifactDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
