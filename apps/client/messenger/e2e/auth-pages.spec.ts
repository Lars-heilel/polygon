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

const screenshotName = (route: string) =>
  `${route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-')}.png`;

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
}

async function expectInteractiveElementsInsideViewport(page: import('@playwright/test').Page) {
  const overflowingElements = await page.locator('input, button, a').evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: element.textContent?.trim() ?? '',
          left: rect.left,
          right: rect.right,
          width: rect.width,
          viewportWidth: window.innerWidth,
        };
      })
      .filter(({ left, right, width, viewportWidth }) => width > 0 && (left < 0 || right > viewportWidth)),
  );

  expect(overflowingElements).toEqual([]);
}

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
  test(`renders ${route} without visual overflow`, async ({ page }) => {
    await page.goto(route);

    await expect(page.getByText(visibleText).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectInteractiveElementsInsideViewport(page);
    await expect(page).toHaveScreenshot(screenshotName(route), {
      fullPage: true,
      animations: 'disabled',
    });
  });
}
