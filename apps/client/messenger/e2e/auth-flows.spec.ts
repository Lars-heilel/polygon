import { expect, test } from '@playwright/test';

async function mockGuestSession(page: import('@playwright/test').Page) {
  await page.route('**/socket.io/**', (route) => route.fulfill({ status: 204 }));
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
}

test.beforeEach(async ({ page }) => {
  await mockGuestSession(page);
});

test('login validates client-side before calling the auth API', async ({ page }) => {
  let loginRequests = 0;
  await page.route('**/api/auth/login', (route) => {
    loginRequests += 1;
    return route.fulfill({ status: 201 });
  });

  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Password is required')).toBeVisible();
  expect(loginRequests).toBe(0);
});

test('login calls the auth API and redirects authenticated users to chats', async ({ page }) => {
  let loginBody: unknown;
  await page.route('**/api/auth/login', async (route) => {
    loginBody = route.request().postDataJSON();
    await route.fulfill({ status: 201 });
  });

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.locator('input[name="password"]').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/chats$/);
  expect(loginBody).toEqual({ email: 'user@example.com', password: 'password' });
});

test('login shows an API error without leaking away from the page', async ({ page }) => {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid credentials' }),
    }),
  );

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.locator('input[name="password"]').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('login shows the rate limit message returned by the auth API', async ({ page }) => {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Too many failed login attempts. Please try again in 15 minutes.',
      }),
    }),
  );

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.locator('input[name="password"]').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(
    page.getByText('Too many failed login attempts. Please try again in 15 minutes.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('login lets users show and hide the password value', async ({ page }) => {
  await page.goto('/auth/login');

  const password = page.locator('input[name="password"]');
  await password.fill('visible-secret');
  await expect(password).toHaveAttribute('type', 'password');

  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');

  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('register validates password confirmation before calling the auth API', async ({ page }) => {
  let registerRequests = 0;
  await page.route('**/api/auth/register', (route) => {
    registerRequests += 1;
    return route.fulfill({ status: 201 });
  });

  await page.goto('/auth/register');
  await page.getByLabel('Username').fill('tester');
  await page.getByLabel('Email').fill('new-user@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Aa1!aaaa');
  await page.getByLabel('Confirm password').fill('Aa1!bbbb');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText("Passwords don't match")).toBeVisible();
  expect(registerRequests).toBe(0);
});

test('register redirects to check-email after successful registration', async ({ page }) => {
  let registerBody: unknown;
  await page.route('**/api/auth/register', async (route) => {
    registerBody = route.request().postDataJSON();
    await route.fulfill({ status: 201 });
  });

  await page.goto('/auth/register');
  await page.getByLabel('Username').fill('tester');
  await page.getByLabel('Email').fill('new-user@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Aa1!aaaa');
  await page.getByLabel('Confirm password').fill('Aa1!aaaa');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/auth\/check-email\?email=new-user%40example\.com$/);
  expect(registerBody).toEqual({
    username: 'tester',
    email: 'new-user@example.com',
    password: 'Aa1!aaaa',
  });
});

test('check-email resends the verification email', async ({ page }) => {
  let resendBody: unknown;
  await page.route('**/api/auth/resend-verification', async (route) => {
    resendBody = route.request().postDataJSON();
    await route.fulfill({ status: 201 });
  });

  await page.goto('/auth/check-email?email=pending%40example.com');
  await page.getByRole('button', { name: 'Resend email' }).click();

  await expect(page.getByText('Email sent — check your inbox.')).toBeVisible();
  expect(resendBody).toEqual({ email: 'pending@example.com' });
});

test('check-email shows resend cooldowns returned by the auth API', async ({ page }) => {
  await page.route('**/api/auth/resend-verification', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Please wait before requesting again' }),
    }),
  );

  await page.goto('/auth/check-email?email=pending%40example.com');
  await page.getByRole('button', { name: 'Resend email' }).click();

  await expect(page.getByText('Please wait before requesting another email.')).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/check-email\?email=pending%40example\.com$/);
});

test('register shows a conflict error returned by the auth API', async ({ page }) => {
  await page.route('**/api/auth/register', (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Email already in use' }),
    }),
  );

  await page.goto('/auth/register');
  await page.getByLabel('Username').fill('tester');
  await page.getByLabel('Email').fill('taken@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Aa1!aaaa');
  await page.getByLabel('Confirm password').fill('Aa1!aaaa');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('This email is already registered.')).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/register$/);
});

test('forgot password submits the email and shows the success state', async ({ page }) => {
  let forgotBody: unknown;
  await page.route('**/api/auth/forgot-password', async (route) => {
    forgotBody = route.request().postDataJSON();
    await route.fulfill({ status: 201 });
  });

  await page.goto('/auth/forgot-password');
  await page.getByLabel('Email').fill('recover@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();

  await expect(page.getByText('We sent a reset link to your email. Check your inbox.')).toBeVisible();
  expect(forgotBody).toEqual({ email: 'recover@example.com' });
});

test('reset password requires a valid token before rendering the form', async ({ page }) => {
  let resetRequests = 0;
  await page.route('**/api/auth/reset-password', (route) => {
    resetRequests += 1;
    return route.fulfill({ status: 201 });
  });

  await page.goto('/auth/reset-password');

  await expect(page.getByText('Invalid or expired reset link.')).toBeVisible();
  expect(resetRequests).toBe(0);
});

test('reset password submits token and redirects to login', async ({ page }) => {
  let resetBody: unknown;
  await page.route('**/api/auth/reset-password', async (route) => {
    resetBody = route.request().postDataJSON();
    await route.fulfill({ status: 201 });
  });

  await page.goto('/auth/reset-password?token=reset-token');
  await page.getByLabel('New password', { exact: true }).fill('Aa1!aaaa');
  await page.getByLabel('Confirm new password').fill('Aa1!aaaa');
  await page.getByRole('button', { name: 'Set new password' }).click();

  await expect(page).toHaveURL(/\/auth\/login$/);
  expect(resetBody).toEqual({ token: 'reset-token', newPassword: 'Aa1!aaaa' });
});
