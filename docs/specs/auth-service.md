# Auth Service - Technical Specification

> **Status:** Almost complete
> **Purpose:** Authentication, OAuth, sessions, email verification

---

## 1. Business Capabilities

- Registration with email, password, and username
- Login with email and password
- Logout with session cleanup
- Refresh-token rotation
- Email verification with a tokenized email link
- Verification email resend
- Password recovery with forgot-password and reset-password flows
- OAuth with GitHub and Google
- Session management: list sessions, revoke one session, revoke all sessions
- Account lockout after 5+ failed login attempts
- Administrative account ban with all-session revocation

## 2. Key Business Flows

### Registration And Login

```text
1. The user enters email, password, and username.
2. The system creates credentials.
3. The system sends a verification email.
4. The first login attempt requires email verification.
5. After verification, the user gets full access.
```

### OAuth

```text
1. The user selects a provider: GitHub or Google.
2. The app redirects the user to the provider authorization page.
3. The user grants access.
4. The callback creates or links the account.
5. The user is logged in automatically.
```

### Password Recovery

```text
1. The user requests a password reset by email.
2. The system sends a one-time reset link that expires in 1 hour.
3. The user sets a new password.
4. The system automatically clears all sessions.
```

### Administrative Account Ban

```text
1. An administrator selects a user and ban duration.
2. Auth validates the administrator role and access hierarchy.
3. The ban state is atomically persisted in the database.
4. All SQL sessions for the user are revoked.
5. All active Redis sessions for the user are removed.
6. A Redis ban marker is set until the ban expires, or permanently.
7. The next login, guard, or active-state check returns 403 ACCOUNT_BANNED.
```

## 3. Important Details

- **Tokens** - Access and refresh JWTs are stored in HttpOnly cookies. Refresh tokens are stored in the database as SHA-256 hashes.
- **Replay-attack protection** - If a revoked refresh token is used, all user sessions are forcefully terminated.
- **Instant revoke** - Revoking a session removes it from Redis; the next request receives `401`.
- **Rate limiting** - 5 login attempts per 15 minutes. After the limit is exceeded, the account is locked for 15 minutes.
- **Email cooldown** - Verification and password-reset emails can be resent no more than once every 60 seconds.
- **Session metadata** - Sessions store device metadata such as OS, browser, IP, country, and last activity time for display in the session list.
- **Cleanup** - Unverified accounts older than 24 hours are deleted automatically every hour.
- **Login rate-limit ban** - A temporary 15-minute lockout after 5 failed login attempts. A successful password reset clears the failed-attempt counter.
- **Admin ban** - A separate administrative ban. It is persisted in the database, mirrored to Redis as a marker for fast checks, revokes all sessions, and returns the safe public contract `ACCOUNT_BANNED` without user payload or log leaks.
- **Admin ban consistency** - Ban and unban operations are protected by a per-target Redis lock. If the Redis marker cannot be set after the SQL ban is persisted, the service attempts to compensate the persisted ban and returns `503`; already revoked sessions are not restored.

---

## 4. Acceptance Criteria / Expected Behavior

### TC-AUTH-1: New User Registration

**Preconditions:**

- The user is not authenticated.
- `user@example.com` is not registered.

**Flow:**

1. The user opens `/auth/register`.
   - The user sees a form with username, email, password, and confirm password fields.
2. The user enters username = `john`, email = `user@example.com`, password = `Pass123!@#`, confirm password = `Pass123!@#`.
3. The user clicks "Register".
   - The button becomes disabled and a spinner is shown.
4. After 1-3 seconds:
   - On success: redirect to `/auth/check-email` with the message "Check your email".
   - On error: the relevant field is highlighted and an error message is shown, for example "Email is already in use".
5. The user receives an email:
   - Subject: "Email verification".
   - Contains a "Verify email" button.
   - Expires after 24 hours.

**Validation Errors:**

- **Username shorter than 2 characters:** red highlight and "Minimum 2 characters".
- **Invalid email format:** "Enter a valid email".
- **Password without a digit, without a special character, or shorter than 8 characters:** "Password must contain...".
- **Confirm password does not match:** "Passwords do not match".
- **Email already exists:** `409` with "Email is already registered".

---

### TC-AUTH-2: Email Verification

**Preconditions:**

- The user has just registered.
- The user is on `/auth/check-email`.

**Flow:**

1. The user opens the email and clicks "Verify email".
   - `/auth/email-verified?token=...` opens.
2. If the token is valid:
   - The page shows "Email verified!" and a "Go to chats" button.
   - HttpOnly cookies are set and the user is logged in automatically.
3. The user clicks "Go to chats".
   - The app redirects to `/chats`.

**Errors:**

- **Expired token, older than 24 hours:** "The link has expired" page with a "Resend" button.
- **Invalid token:** "The link is invalid".
- **Repeated verification for an already verified account:** "Email is already verified".

---

### TC-AUTH-3: Login

**Preconditions:**

- The user is registered and verified.

**Flow:**

1. The user opens `/auth/login`.
   - The form has email and password fields, a "Log in" button, a "Forgot password" link, and OAuth buttons.
2. The user enters email = `user@example.com`, password = `Pass123!@#`.
3. The user clicks "Log in".
   - The button is disabled and a spinner is shown.
4. On success:
   - The app redirects to `/chats`.
   - HttpOnly cookies are set: `access_token` and `refresh_token`.
5. The user refreshes the page.
   - The user remains on `/chats`; the session is restored through cookies.

**Errors:**

- **Invalid email:** "User not found".
- **Invalid password:** "Invalid password".
- **Email is not verified:** "Verify your email" with a "Resend" button.
- **Account locked after failed attempts:** "Account is locked for 15 minutes".
- **5 consecutive failed attempts:** the fifth attempt shows the lockout message.

---

### TC-AUTH-4: OAuth With GitHub / Google

**Flow:**

1. The user clicks "Log in with GitHub" on the login page.
   - The app redirects to GitHub for application authorization.
2. The user grants access.
   - The provider calls back to the server.
   - If the user already exists: the user is logged in and cookies are set.
   - If this is a new user: the system creates the account, creates the profile, and logs the user in.
3. The app redirects to `/chats`.

**Edge Cases:**

- **OAuth email matches an existing account:** link the OAuth provider to the existing account.
- **Provider error:** redirect back to login with "Authorization through {provider} failed".
- **Provider-side cancellation:** return to login.

---

### TC-AUTH-5: Transparent Refresh Token Flow

**Preconditions:**

- The user is authenticated and the `access_token` is close to expiration.

**Flow:**

1. The user keeps using the app.
2. The app sends an API request and the server returns `401`.
3. The client automatically, without user interaction:
   - Sends `POST /api/auth/refresh` using `refresh_token` from the cookie.
   - The server validates the refresh token and issues a new token pair.
   - The original request is retried with the new `access_token`.
4. The user does not notice the refresh; the request succeeds.

**Errors:**

- **Expired refresh token:** redirect to `/auth/login`.
- **Revoked refresh token, replay attack:** the system revokes all user sessions and redirects to `/auth/login`.

---

### TC-AUTH-6: Session Management

**Preconditions:**

- The user is authenticated on 3 devices: Windows/Chrome, Mac/Safari, and iOS.

**Flow:**

1. The user opens Settings -> Devices.
   - The session list shows device name, browser, OS, IP, country, and last activity time.
   - The current session is marked as "This device".
2. The user clicks "Revoke" on the Mac/Safari session.
   - The session disappears from the list.
   - On Mac/Safari, the next request returns `401` and redirects to login.
3. The user clicks "Terminate all other sessions".
   - All sessions except the current one are revoked.
   - Other devices are forcefully logged out.

---

### TC-AUTH-7: Password Recovery

**Flow:**

1. The user clicks "Forgot password?" on the login page.
   - An email input is shown.
2. The user enters an email and clicks "Send".
   - The page shows "Check your email".
3. The user receives an email with a "Reset password" button that expires in 1 hour.
4. The user opens the link and sees the new password form.
5. The user enters the new password twice and saves.
   - All sessions are revoked.
   - The app redirects to `/auth/login` with "Password changed".

**Errors:**

- **Email is not registered:** still show "Check your email" to avoid account enumeration.
- **Expired token:** the link does not work and the user sees "Request a new reset link".
- **Repeated request within 60 seconds:** "Try again in a minute".

---

### TC-AUTH-8: Login Attempt Lockout

**Preconditions:**

- The account exists.
- The user does not know the password.

**Flow:**

1. The user enters an invalid password 5 times in a row.
   - Attempts 1-4: "Invalid password" and the counter increases.
   - Attempt 5: "Account is locked for 15 minutes".
2. The user tries to log in immediately.
   - The user sees "Account is locked for 14 more minutes".
3. After 15 minutes, login is possible again.
4. If the user resets the password through "Forgot password", the lockout is cleared.

---

### TC-AUTH-9: Administrative Account Ban

**Preconditions:**

- The actor has an administrator role that can manage the target account.
- The target account exists.

**Flow:**

1. The actor sends an admin ban command with duration (`ONE_HOUR`, `ONE_DAY`, `SEVEN_DAYS`, `THIRTY_DAYS`, `PERMANENT`) and reason (`SPAM`, `BULLYING`, `UNACCEPTABLE_CONTENT`, `SUSPICIOUS_ACTIVITY`, `CUSTOM`).
2. Auth validates actor and target existence, then validates role hierarchy.
3. If the request is valid:
   - The persisted ban state is stored in the database.
   - All SQL sessions for the target are revoked.
   - All Redis sessions for the target are removed.
   - The Redis ban marker is set with a TTL or permanently.
4. The target tries to log in or pass an active-account check:
   - The target receives `403`, `code = ACCOUNT_BANNED`, `message = Account is banned`, `reason`, and `bannedUntil`.
5. If a temporary ban has expired:
   - The next active-account check normalizes the expired ban and allows the user through.
6. The actor sends an unban command:
   - The persisted ban state is cleared.
   - The Redis ban marker is removed.

**Errors:**

- **Actor not found:** `404 Actor not found`.
- **Target not found:** `404 Target not found`.
- **Insufficient role or self-target forbidden:** `403 Insufficient role hierarchy`.
- **Invalid payload:** `400 Invalid ban request`.
- **Parallel operation for the same target:** `409 Account state is being updated`.
- **Redis or database operational failure:** `503 Unable to establish ban state` or `503 Unable to clear ban state`.

---

## 5. Implementation Status

| Feature | Status |
| --- | --- |
| Registration | Done |
| Login | Done |
| Logout | Done |
| Refresh token with replay protection | Done |
| Email verification | Done |
| Resend verification with cooldown | Done |
| Forgot / reset password | Done |
| OAuth GitHub | Done |
| OAuth Google | Done |
| Session list | Done |
| Session revocation | Done |
| Revoke all sessions | Done |
| Login rate limiting | Done |
| Old account cleanup | Done |
| Account lockout after failed login attempts | Done |
| Administrative account ban | Done |
| Instant revoke with Redis | Done |
| Email templates with react-email | Needs work |
