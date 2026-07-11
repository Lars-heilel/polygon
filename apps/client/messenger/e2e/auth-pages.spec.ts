import { expect, test } from '@playwright/test';

const authRoutes = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password?token=demo-token',
  '/auth/reset-password',
  '/auth/check-email?email=very-long-address-for-layout-check@example.com',
  '/auth/email-verified',
] as const;

test.beforeEach(async ({ page }) => {
  await page.route('**/api/users/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated' }),
    }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated' }),
    }),
  );
});

for (const route of authRoutes) {
  test(`renders ${route} without horizontal overflow`, async ({ page }) => {
    await page.goto(route);

    await expect(page.locator('body')).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
