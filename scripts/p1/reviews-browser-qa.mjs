import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const database = new URL(process.env.DATABASE_URL ?? 'http://invalid');
if (database.pathname !== '/reviews_test' || !['127.0.0.1', 'localhost'].includes(database.hostname)) {
  throw new Error('DATABASE_URL must target the local disposable reviews_test database.');
}
const baseUrl = process.env.REVIEWS_QA_BASE_URL;
if (!baseUrl || !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) throw new Error('Set a local REVIEWS_QA_BASE_URL.');

const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { PrismaClient } = requireApi('@prisma/client');
const prisma = new PrismaClient();
const artifactDir = resolve('artifacts/reviews-qa', `${Date.now()}`);
await mkdir(artifactDir, { recursive: true });
const report = { checks: [], findings: [], artifactDir };
const browser = await chromium.launch({ headless: true });
let userId;
let salonId;
let workspaceId;

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));

  const registered = await context.request.post(`${baseUrl}/api/v1/auth/register`, { data: {
    email: `browser-review-${Date.now()}@example.test`,
    displayName: 'Review Browser QA',
    password: 'Disposable-QA-only-123!'
  } });
  expect(registered.status()).toBe(201);
  userId = (await registered.json()).user.id;
  await prisma.professionalProfile.create({ data: { userId, status: 'ACTIVE' } });
  const salon = await prisma.salon.create({ data: { name: 'Browser Review Salon', area: 'District 1', timezone: 'Asia/Ho_Chi_Minh' } });
  salonId = salon.id;
  const workspace = await prisma.workspace.create({ data: { salonId, name: 'Browser Review Chair', status: 'PUBLISHED' } });
  workspaceId = workspace.id;
  const rental = await prisma.rentalOption.create({ data: { workspaceId, label: 'Completed session', priceCents: 250000 } });
  const slot = await prisma.availabilitySlot.create({ data: {
    workspaceId,
    rentalOptionId: rental.id,
    localDate: new Date('2026-08-01T00:00:00.000Z'),
    startsAt: new Date('2026-08-01T02:00:00.000Z'),
    endsAt: new Date('2026-08-01T04:00:00.000Z'),
    status: 'BOOKED'
  } });
  const booking = await prisma.booking.create({ data: {
    availabilitySlotId: slot.id,
    professionalUserId: userId,
    status: 'COMPLETED',
    workspaceName: workspace.name,
    rentalOptionLabel: rental.label,
    priceCents: rental.priceCents,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    salonTimezone: salon.timezone,
    localDate: slot.localDate,
    completedAt: slot.endsAt
  } });

  await page.goto(`${baseUrl}/bookings`);
  await page.getByRole('button', { name: 'Past', exact: true }).click();
  const card = page.locator(`[data-booking-id="${booking.id}"]`);
  await expect(card.getByRole('heading', { name: workspace.name })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'How was this salon?' })).toBeVisible();
  report.checks.push('A completed rental owned by the signed-in Professional exposes the review form.');

  await card.getByLabel('Rating').selectOption('4');
  await card.getByLabel('Your review (optional)').fill('Bright workspace and helpful staff.');
  const publishResponse = page.waitForResponse((response) => response.url().endsWith(`/bookings/${booking.id}/reviews`) && response.request().method() === 'POST');
  await card.getByRole('button', { name: 'Publish review', exact: true }).click();
  expect((await publishResponse).status()).toBe(201);
  await expect(card.getByText(/Review published/)).toBeVisible();
  const persisted = await prisma.review.findUnique({ where: { bookingId: booking.id } });
  expect(persisted).toMatchObject({ salonId, authorUserId: userId, rating: 4, body: 'Bright workspace and helpful staff.', status: 'PUBLISHED' });
  report.checks.push('Publishing uses the real API and persists one PUBLISHED review linked to the Booking and Salon.');

  await page.reload();
  await page.getByRole('button', { name: 'Past', exact: true }).click();
  await expect(page.locator(`[data-booking-id="${booking.id}"]`).getByText(/Review published/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How was this salon?' })).toHaveCount(0);
  report.checks.push('Reload keeps the reviewed state and does not offer a second review form.');

  await page.goto(`${baseUrl}/workspaces/${workspaceId}?date=2099-08-02`);
  await expect(page.getByRole('heading', { name: 'What professionals say' })).toBeVisible();
  await expect(page.getByText('Bright workspace and helpful staff.')).toBeVisible();
  await expect(page.getByText(/1 review/)).toBeVisible();
  await page.screenshot({ path: resolve(artifactDir, 'desktop-review.png'), fullPage: true });
  report.checks.push('The public Workspace page shows the Salon score and verified review from MySQL.');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: resolve(artifactDir, 'mobile-review.png'), fullPage: true });
  expect(browserErrors).toEqual([]);
  report.checks.push('The review panel has no horizontal overflow at 390px and no uncaught browser errors.');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (userId) {
    await prisma.review.deleteMany({ where: { authorUserId: userId } });
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
