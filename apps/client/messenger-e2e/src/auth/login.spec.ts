import { API_ROUTES, CLIENT_ROUTES } from '@org/common';
import { expect, test } from '@playwright/test';

const validCredentials = {
  email: 'user@example.com',
  password: 'Password1!',
};

const meResponse = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'testuser',
  displayName: null,
  avatarUrl: null,
  bio: null,
};

async function fillLoginForm(
  page: import('@playwright/test').Page,
  values: Partial<typeof validCredentials> = {},
) {
  const data = { ...validCredentials, ...values };
  if (data.email) await page.getByLabel('Email').fill(data.email);
  if (data.password) await page.getByLabel('Password').fill(data.password);
}

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('renders all form fields and submit button', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('has link to register page', async ({ page }) => {
    const link = page.getByRole('link', { name: /sign up/i });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('has forgot password link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
  });

  test('happy path: navigates to chats after successful login', async ({ page }) => {
    await page.route(`**/${API_ROUTES.auth.login}`, (route) => route.fulfill({ status: 200 }));
    await page.route(`**/${API_ROUTES.users.me}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(meResponse),
      }),
    );

    await fillLoginForm(page);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(new RegExp(CLIENT_ROUTES.chats.root));
  });

  // BUG: ISSUE-1 — useLogin catches all errors and shows generic "Invalid email or password"
  // regardless of the actual error. A 401 with "Email not verified" should show a different
  // message with a link to resend verification. A 429 should tell the user to wait.
  // This test WILL FAIL until ISSUE-1 is fixed.
  test('[BUG ISSUE-1] shows "email not verified" message on 401 unverified', async ({ page }) => {
    await page.route(`**/${API_ROUTES.auth.login}`, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email not verified' }),
      }),
    );

    await fillLoginForm(page);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Currently shows "Invalid email or password" — should show verification message
    await expect(page.getByText(/verify your email/i)).toBeVisible();
  });

  // BUG: ISSUE-1 — 429 should show rate limit message, not generic auth error
  test('[BUG ISSUE-1] shows rate-limit message on 429', async ({ page }) => {
    await page.route(`**/${API_ROUTES.auth.login}`, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Too many requests' }),
      }),
    );

    await fillLoginForm(page);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Currently shows generic error — should show rate limit message
    await expect(page.getByText(/too many attempts/i)).toBeVisible();
  });

  test('shows generic error toast on wrong credentials (401)', async ({ page }) => {
    await page.route(`**/${API_ROUTES.auth.login}`, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      }),
    );

    await fillLoginForm(page);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('shows validation error when email is empty', async ({ page }) => {
    await page.getByLabel('Password').fill('Password1!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('shows validation error when password is empty', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/password/i)).toBeVisible();
  });

  test('submit button is disabled while request is in flight', async ({ page }) => {
    let resolveRequest!: () => void;
    await page.route(`**/${API_ROUTES.auth.login}`, async (route) => {
      await new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });
      await route.fulfill({ status: 200 });
    });

    await fillLoginForm(page);
    await page.getByRole('button', { name: /sign in/i }).click();

    const submitButton = page.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toBeDisabled();

    resolveRequest();
  });
});
