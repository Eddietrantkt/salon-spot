import { expect, test, type Page } from '@playwright/test';

const demoPassword = 'SalonDemo#2026';

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(demoPassword);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
}

test('direct URLs, refresh and browser back preserve public navigation', async ({ page }) => {
  await page.goto('/?area=D1&date=2099-12-17');
  await expect(page.getByRole('link', { name: 'Explore' }).first()).toBeVisible();
  await page.goto('/owner');
  await expect(page.getByRole('heading', { name: 'Manage your salon spaces' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Manage your salon spaces' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Sign in to Owner Console' }).click();
  await signIn(page, 'owner.demo@salonspot.local');
  await expect(page.getByText('Linh Nguyen — Owner Demo')).toBeVisible();

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'System administration' })).toBeVisible();
  await expect(page.getByText('Signed in as Linh Nguyen — Owner Demo')).toBeVisible();
  await expect(page.getByText(/not authorized|administrator|forbidden/i)).toBeVisible();
});

test('Admin console accepts an Admin session and exposes operations data', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sign in to Admin' }).click();
  await signIn(page, 'admin.demo@salonspot.local');
  await expect(page.getByRole('heading', { name: 'System administration' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manage account status' })).toBeVisible();
});

for (const width of [320, 375, 768]) {
  test(`role navigation remains present at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: width <= 760 ? 'Mobile navigation' : 'Primary navigation' });
    await expect(navigation).toContainText('Explore');
    await expect(navigation).toContainText('Owner');
    await expect(navigation).toContainText('Admin');
  });
}
