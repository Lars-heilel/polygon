import { expect, test } from '@playwright/test';

const authRoutes = [
  ['/auth/login', 'Welcome back'],
  ['/auth/register', 'Create account'],
  ['/auth/forgot-password', 'Reset password'],
  ['/auth/reset-password?token=demo-token', 'New password'],
  ['/auth/reset-password', 'Invalid or expired reset link.'],
  ['/auth/check-email', 'Check your email'],
  ['/auth/email-verified', 'Email verified'],
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

for (const [route, visibleText] of authRoutes) {
  test(`renders ${route} without horizontal overflow`, async ({ page }) => {
    await page.goto(route);

    await expect(page.getByText(visibleText).first()).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
