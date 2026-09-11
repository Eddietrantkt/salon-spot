import { expect, test, type Page } from '@playwright/test';

const demoPassword = 'SalonDemo#2026';
const ownerPublishPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(demoPassword);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
}

test('direct URLs, refresh and browser back preserve public navigation', async ({ page }) => {
  await page.goto('/?area=D1&date=2099-12-17');
  await expect(page.getByRole('link', { name: 'Explore' }).first()).toBeVisible();
  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Sign in to open the Owner portal' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to open the Owner portal' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: 'Explore' }).first()).toBeVisible();
});

test('public search rejects dates before tomorrow', async ({ page }) => {
  await page.goto('/');
  const date = page.locator('input[type="date"]').first();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1);
  await date.fill(pastDate.toISOString().slice(0, 10));

  expect(await date.evaluate((control) => (control as HTMLInputElement).validity.rangeUnderflow)).toBe(true);
});

test('Owner session persists while the Admin console rejects its unavailable capability', async ({ page }) => {
  await page.goto('/owner');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await signIn(page, 'owner.demo@salonspot.local');
  await expect(page.getByText('Linh Nguyen — Owner Demo')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Admin' })).toHaveCount(0);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'This area is not assigned to your account' })).toBeVisible();
  await expect(page.getByText('Hi, Linh Nguyen — Owner Demo')).toBeVisible();
});

test('Owner can create, publish, open availability, and expose a workplace to Explore', async ({ page }) => {
  const suffix = Date.now();
  const salonName = `QA Salon ${suffix}`;
  const workspaceName = `QA Workspace ${suffix}`;
  const area = `QA-D1-${suffix}`;
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const localDate = date.toISOString().slice(0, 10);

  await page.goto('/owner');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await signIn(page, 'owner.demo@salonspot.local');
  await expect(page.getByText('Linh Nguyen — Owner Demo')).toBeVisible();

  await page.getByLabel('Salon name').fill(salonName);
  await page.getByLabel('Location').fill(area);
  await page.getByLabel('Workspace name').fill(workspaceName);
  await page.getByLabel('Rental label').fill('QA session');
  await page.getByLabel('Rate (VND)').fill('300000');
  await page.getByRole('button', { name: 'Create salon & workspace' }).click();

  await expect(page.getByText(`${salonName} and its first workspace were created in DRAFT.`)).toBeVisible();
  const salonCard = page.locator('.salon-card').filter({ hasText: salonName });
  const workspaceItem = salonCard.locator('.workspace-list > li').filter({ hasText: workspaceName });
  await expect(workspaceItem.getByText('DRAFT')).toBeVisible();

  const mediaInputs = workspaceItem.locator('input[type="file"]');
  await expect(mediaInputs).toHaveCount(1);
  await mediaInputs.setInputFiles({ name: 'qa-workspace.png', mimeType: 'image/png', buffer: ownerPublishPng });
  await expect(page.getByText('The photo was validated, processed, and is READY.')).toBeVisible();

  await workspaceItem.getByRole('button', { name: 'Review & publish' }).click();
  await expect(page.getByText('The workspace passed the checklist and was published.')).toBeVisible();
  await expect(workspaceItem.getByText('PUBLISHED')).toBeVisible();

  await workspaceItem.getByRole('button', { name: 'Open 1 slot' }).click();
  await expect(workspaceItem.getByRole('status')).toContainText('1 open');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto(`/?area=${encodeURIComponent(area)}&date=${localDate}`);
  await expect(page.getByRole('heading', { name: workspaceName })).toBeVisible();
});

test('Admin console accepts an Admin session and exposes operations data', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await signIn(page, 'admin.demo@salonspot.local');
  await expect(page.getByRole('heading', { name: 'Operations for Operations — Admin Demo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manage account status' })).toBeVisible();
});

for (const width of [320, 375, 768]) {
  test(`guest navigation is limited at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: width <= 760 ? 'Mobile navigation' : 'Primary navigation' });
    await expect(navigation).toContainText('Explore');
    await expect(navigation).toContainText('Sign in');
    await expect(navigation).not.toContainText('Owner');
    await expect(navigation).not.toContainText('Admin');
  });
}

test('mobile registration keeps its heading readable and decorative benefits silent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');

  const firstBenefitSnapshot = await page.locator('.auth-benefits li').first().ariaSnapshot();
  expect(firstBenefitSnapshot).not.toContain('✓');

  await page.getByRole('button', { name: 'VI' }).click();
  await page.getByRole('button', { name: 'Tạo tài khoản' }).first().click();

  const registrationHeading = page.getByRole('heading', { name: 'Bắt đầu với một tài khoản' });
  const headingWidth = await registrationHeading.evaluate((element) => element.getBoundingClientRect().width);
  const cardWidth = await page.locator('.auth-card').evaluate((element) => element.getBoundingClientRect().width);

  expect(headingWidth).toBeGreaterThan(cardWidth * 0.75);
});

test('selected location exposes its pressed state without repeating a decorative check', async ({ page }) => {
  await page.goto('/');

  const selectedLocationSnapshot = await page.locator('.location-chip-selected').ariaSnapshot();
  expect(selectedLocationSnapshot).toContain('[pressed]');
  expect(selectedLocationSnapshot).not.toContain('✓');
});
