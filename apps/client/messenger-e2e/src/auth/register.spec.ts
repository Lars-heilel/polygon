import { API_ROUTES } from '@org/common';
import { expect, test } from '@playwright/test';

const validForm = {
  username: 'testuser',
  email: 'user@example.com',
  password: 'Password1!',
  confirmPassword: 'Password1!',
};

async function fillRegisterForm(
  page: import('@playwright/test').Page,
  values: Partial<typeof validForm> = {},
) {
  const data = { ...validForm, ...values };
  if (data.username) await page.getByLabel('Username').fill(data.username);
  if (data.email) await page.getByLabel('Email').fill(data.email);
  if (data.password) await page.getByLabel('Password', { exact: true }).fill(data.password);
  if (data.confirmPassword) await page.getByLabel('Confirm password').fill(data.confirmPassword);
}

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
  });

  test('renders all form fields and submit button', async ({ page }) => {
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('happy path: navigates to check-email with email param', async ({ page }) => {
    await page.route(API_ROUTES.auth.register, (route) => route.fulfill({ status: 201 }));

    await fillRegisterForm(page);
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/auth\/check-email\?email=user%40example\.com/);
    await expect(page.getByText(/user@example\.com/)).toBeVisible();
  });

  test('shows inline error on 409 conflict', async ({ page }) => {
    await page.route(API_ROUTES.auth.register, (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email already in use' }),
      }),
    );

    await fillRegisterForm(page);
    await page.getByRole('button', { name: /create account/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/this email is already registered/i);
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('shows generic error on server failure', async ({ page }) => {
    await page.route(API_ROUTES.auth.register, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' }),
      }),
    );

    await fillRegisterForm(page);
    await page.getByRole('button', { name: /create account/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/registration failed/i);
  });

  test('shows validation error when email is empty', async ({ page }) => {
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('Password', { exact: true }).fill('Password1!');
    await page.getByLabel('Confirm password').fill('Password1!');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('shows validation error when passwords do not match', async ({ page }) => {
    await fillRegisterForm(page, { confirmPassword: 'Different1!' });
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/passwords don't match/i)).toBeVisible();
  });

  test('clears error alert on retry after 409', async ({ page }) => {
    let callCount = 0;
    await page.route(API_ROUTES.auth.register, (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Email already in use' }),
        });
      } else {
        route.fulfill({ status: 201 });
      }
    });

    await fillRegisterForm(page);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/auth\/check-email/);
  });
});

test.describe('Check-email page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/check-email?email=user%40example.com');
  });

  test('displays the email from query param', async ({ page }) => {
    await expect(page.getByText(/user@example\.com/)).toBeVisible();
  });

  test('shows success alert after resend', async ({ page }) => {
    await page.route(API_ROUTES.auth.resendVerification, (route) => route.fulfill({ status: 201 }));

    await page.getByRole('button', { name: /resend email/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/email sent/i);
  });

  test('shows rate-limited alert on 429', async ({ page }) => {
    await page.route(API_ROUTES.auth.resendVerification, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Too many requests' }),
      }),
    );

    await page.getByRole('button', { name: /resend email/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/please wait/i);
  });

  test('shows error alert on server failure', async ({ page }) => {
    await page.route(API_ROUTES.auth.resendVerification, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' }),
      }),
    );

    await page.getByRole('button', { name: /resend email/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/failed to send/i);
  });

  test('has back to sign in link', async ({ page }) => {
    const link = page.getByRole('link', { name: /back to sign in/i });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
