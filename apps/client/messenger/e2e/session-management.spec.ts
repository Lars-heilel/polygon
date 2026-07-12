import { expect, test } from '@playwright/test';

const sessions = [
  {
    id: 'session-current',
    device: 'Desktop',
    browser: 'Chrome',
    os: 'Linux',
    ip: '127.0.0.1',
    country: 'Local',
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    isCurrent: true,
  },
  {
    id: 'session-other',
    device: 'Mobile',
    browser: 'Safari',
    os: 'iOS',
    ip: '203.0.113.10',
    country: 'Remote',
    lastActiveAt: new Date(Date.now() - 60_000).toISOString(),
    createdAt: new Date(Date.now() - 120_000).toISOString(),
    isCurrent: false,
  },
];

async function mockAuthenticatedSession(page: import('@playwright/test').Page) {
  await page.route('**/socket.io/**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/users/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-1',
        username: 'tester',
        displayName: 'Tester',
        role: 'USER',
      }),
    }),
  );
  await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 201 }));
  await page.route('**/api/auth/sessions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessions),
      });
    }

    return route.fulfill({ status: 201 });
  });
}

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedSession(page);
});

test('settings devices tab lists sessions and revokes another session in place', async ({ page }) => {
  let revokedSession: string | null = null;
  await page.route('**/api/auth/sessions/session-other', (route) => {
    revokedSession = 'session-other';
    return route.fulfill({ status: 200 });
  });

  await page.goto('/chats/settings');
  await page.getByRole('button', { name: 'devices' }).click();

  await expect(page.getByText('Chrome on Linux')).toBeVisible();
  await expect(page.getByText('Safari on iOS')).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();

  await page.getByRole('button', { name: 'Logout Safari on iOS session' }).click();

  await expect.poll(() => revokedSession).toBe('session-other');
  await expect(page).toHaveURL(/\/chats\/settings$/);
});

test('settings devices tab redirects to login after revoking the current session', async ({ page }) => {
  await page.route('**/api/auth/sessions/session-current', (route) => route.fulfill({ status: 200 }));

  await page.goto('/chats/settings');
  await page.getByRole('button', { name: 'devices' }).click();

  await page.getByRole('button', { name: 'Logout current session' }).click();

  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('settings devices tab redirects to login after revoking all sessions', async ({ page }) => {
  await page.goto('/chats/settings');
  await page.getByRole('button', { name: 'devices' }).click();
  await page.getByRole('button', { name: 'Logout from all devices' }).click();

  await expect(page).toHaveURL(/\/auth\/login$/);
});
