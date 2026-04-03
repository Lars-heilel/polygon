# Phase 1: Auth Flow Production-Ready — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining auth gaps: reuse detection, OAuth search sync, missing unit tests, missing controller tests, and a security checklist pass.

**Architecture:** All changes are in the auth service layer (`libs/backend/auth`) and gateway integration tests (`apps/backend/gateway/src/controllers/auth.controller.spec.ts`). No new endpoints, no schema changes, no new libraries — only logic fixes and test coverage.

**Tech Stack:** NestJS 11, Jest, Passport, JWT, Redis, Prisma (PostgreSQL)

---

## Current State (as of 2026-04-03)

**Already done — DO NOT re-implement:**

- ✅ Cookie flags (httpOnly, sameSite, secure) — both `setTokenCookies` and `clearTokenCookies`
- ✅ Rate limiting on login — Redis `incr`, 5 attempts / 15 min window
- ✅ Refresh token rotation — old token revoked before new pair issued
- ✅ `auth.service.spec.ts` — register, validateCredentials, login, refresh, logout, resendVerification
- ✅ `auth.controller.spec.ts` — register, login, refresh, logout, forgot-password, reset-password
- ✅ TokenService, EncryptionService, JwtGuard, CleanupService tests
- ✅ VerificationService tests (generate, verify, resend, cooldown, password reset)
- ✅ CleanupService wired with `@Cron(CronExpression.EVERY_HOUR)`
- ✅ E2E: login, logout, refresh
- ✅ Frontend auth hooks tests

**What this plan adds:**

- ❌ Reuse detection in `refresh()` (revoke all on revoked token replay)
- ❌ `oauthLogin` missing `searchClient.emit` on new user creation
- ❌ Unit tests: `verifyEmail`, `forgotPassword`, `resetPassword`, `oauthLogin`
- ❌ Controller tests: `GET /api/auth/verify-email`, `POST /api/auth/resend-verification`
- ❌ Security review checklist

---

## File Map

| File                                                           | Action | Responsibility                                                                     |
| -------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| `libs/backend/auth/src/services/auth.service.ts`               | Modify | Reuse detection in `refresh()`, searchClient emit in `oauthLogin()`                |
| `libs/backend/auth/src/services/auth.service.spec.ts`          | Modify | Add: verifyEmail, forgotPassword, resetPassword, oauthLogin, reuse detection tests |
| `apps/backend/gateway/src/controllers/auth.controller.spec.ts` | Modify | Add: verify-email, resend-verification endpoint tests                              |

---

### Task 1: Refresh token reuse detection

If a revoked refresh token is used again (replay attack), revoke ALL tokens for that user — not just return 401.

**Files:**

- Modify: `libs/backend/auth/src/services/auth.service.ts:159-176` (`refresh` method)
- Modify: `libs/backend/auth/src/services/auth.service.spec.ts`

- [ ] **Step 1: Add the failing test**

In `libs/backend/auth/src/services/auth.service.spec.ts`, add inside `describe('refresh', ...)` after the existing tests:

```typescript
it('revokes ALL user tokens when a revoked token is replayed', async () => {
  mockTokenService.verifyRefreshToken.mockReturnValue({
    sub: 'user-id',
    role: 'USER',
    isVerified: true,
  });
  mockRepo.findRefreshToken.mockResolvedValue({
    tokenHash: 'hash',
    credentialsId: 'user-id',
    revokedAt: new Date(), // already revoked
    expiresAt: new Date(Date.now() + 60000),
  });

  await expect(service.refresh('some-refresh-token')).rejects.toThrow(
    expect.objectContaining({ status: 401 }),
  );

  expect(mockRepo.revokeAllRefreshTokens).toHaveBeenCalledWith('user-id');
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
npx nx test @org/auth --testPathPatterns="auth.service.spec" --no-coverage --skipNxCache 2>&1 | grep -E "FAIL|revokes ALL"
```

Expected: FAIL — `revokeAllRefreshTokens` not called

- [ ] **Step 3: Update `refresh()` in `libs/backend/auth/src/services/auth.service.ts`**

Replace the current `refresh` method body (the check `if (!stored || stored.revokedAt || ...)`) with:

```typescript
async refresh(refreshToken: string): Promise<TokenPair> {
  let payload: JwtPayload;
  try {
    payload = this.tokenService.verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedException();
  }

  const tokenHash = this.hashToken(refreshToken);
  const stored = await this.repo.findRefreshToken(tokenHash);

  if (!stored) throw new UnauthorizedException();

  // Replay attack: revoked token reused → invalidate entire token family
  if (stored.revokedAt) {
    await this.repo.revokeAllRefreshTokens(stored.credentialsId);
    throw new UnauthorizedException();
  }

  if (stored.expiresAt < new Date()) throw new UnauthorizedException();

  await this.repo.revokeRefreshToken(tokenHash);

  const credentials = await this.repo.findById(payload.sub);
  if (!credentials) throw new UnauthorizedException();

  return this.issueTokenPair(credentials);
}
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
npx nx test @org/auth --testPathPatterns="auth.service.spec" --no-coverage --skipNxCache 2>&1 | grep -E "PASS|Tests:"
```

Expected: PASS, all existing refresh tests still green

- [ ] **Step 5: Typecheck**

```bash
npx nx typecheck @org/auth --skipNxCache 2>&1 | tail -3
```

Expected: `Successfully ran target typecheck`

- [ ] **Step 6: Commit**

```bash
git add libs/backend/auth/src/services/auth.service.ts libs/backend/auth/src/services/auth.service.spec.ts
git commit -m "feat(auth): revoke all tokens on refresh token replay attack"
```

---

### Task 2: OAuth — emit to searchClient on new user creation

`oauthLogin` emits `USER_EVENTS.REGISTERED` to `userClient` when creating a new user, but not to `searchClient`. New OAuth users won't appear in search.

**Files:**

- Modify: `libs/backend/auth/src/services/auth.service.ts` (`oauthLogin` method)
- Modify: `libs/backend/auth/src/services/auth.service.spec.ts`

- [ ] **Step 1: Add the failing test**

In `libs/backend/auth/src/services/auth.service.spec.ts`, add a new `describe('oauthLogin', ...)` block after the `resendVerification` block:

```typescript
describe('oauthLogin', () => {
  const dto: OAuthLoginDto = {
    provider: 'GITHUB',
    providerId: 'gh-123',
    email: 'oauth@example.com',
    name: 'OAuth User',
  };

  const credentials = {
    id: 'cred-id',
    email: dto.email,
    role: 'USER' as const,
    isVerified: true,
    passwordHash: null,
  };

  beforeEach(() => {
    mockTokenService.generateAccessToken.mockReturnValue('access');
    mockTokenService.generateRefreshToken.mockReturnValue('refresh');
    mockRepo.saveRefreshToken.mockResolvedValue(undefined);
    jest.spyOn(require('crypto'), 'createHash').mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('hashed'),
    } as any);
  });

  it('returns existing TokenPair when OAuth account already exists', async () => {
    mockRepo.findOAuthAccount.mockResolvedValue({ credentials });

    const result = await service.oauthLogin(dto);

    expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    expect(mockRepo.createCredentials).not.toHaveBeenCalled();
  });

  it('creates new credentials when no existing account and emits to userClient and searchClient', async () => {
    mockRepo.findOAuthAccount.mockResolvedValue(null);
    mockRepo.findByEmail.mockResolvedValue(null);
    mockRepo.createCredentials.mockResolvedValue(credentials);
    mockRepo.createOAuthAccount.mockResolvedValue(undefined);
    mockRepo.verifyCredentials.mockResolvedValue(undefined);

    await service.oauthLogin(dto);

    expect(mockUserClient.emit).toHaveBeenCalledWith(
      USER_EVENTS.REGISTERED,
      expect.objectContaining({ id: credentials.id, name: dto.name }),
    );
    expect(mockSearchClient.emit).toHaveBeenCalledWith(
      USER_EVENTS.REGISTERED,
      expect.objectContaining({ id: credentials.id, name: dto.name }),
    );
  });

  it('links OAuth account to existing credentials when email matches', async () => {
    mockRepo.findOAuthAccount.mockResolvedValue(null);
    mockRepo.findByEmail.mockResolvedValue(credentials);
    mockRepo.createOAuthAccount.mockResolvedValue(undefined);

    await service.oauthLogin(dto);

    expect(mockRepo.createCredentials).not.toHaveBeenCalled();
    expect(mockRepo.createOAuthAccount).toHaveBeenCalledWith(
      expect.objectContaining({ provider: dto.provider, credentialsId: credentials.id }),
    );
  });

  it('auto-verifies credentials when linking via OAuth and not yet verified', async () => {
    const unverified = { ...credentials, isVerified: false };
    mockRepo.findOAuthAccount.mockResolvedValue(null);
    mockRepo.findByEmail.mockResolvedValue(unverified);
    mockRepo.createOAuthAccount.mockResolvedValue(undefined);
    mockRepo.verifyCredentials.mockResolvedValue(undefined);

    await service.oauthLogin(dto);

    expect(mockRepo.verifyCredentials).toHaveBeenCalledWith(credentials.id);
  });
});
```

Note: add `SEARCH_CLIENT_TOKEN` to the test module imports if missing:

```typescript
{ provide: SEARCH_CLIENT_TOKEN, useValue: mockSearchClient },
```

And ensure `mockSearchClient` is declared alongside `mockUserClient`:

```typescript
const mockSearchClient = { emit: jest.fn(), send: jest.fn() };
```

- [ ] **Step 2: Run the test — expect FAIL on searchClient assertion**

```bash
npx nx test @org/auth --testPathPatterns="auth.service.spec" --no-coverage --skipNxCache 2>&1 | grep -E "searchClient|FAIL|oauthLogin"
```

Expected: FAIL — `mockSearchClient.emit` not called

- [ ] **Step 3: Add searchClient emit to `oauthLogin` in `libs/backend/auth/src/services/auth.service.ts`**

In the `oauthLogin` method, find the block that creates new credentials:

```typescript
if (!credentials) {
  credentials = await this.repo.createCredentials({ email: dto.email });
  this.userClient.emit(USER_EVENTS.REGISTERED, {
    id: credentials.id,
    email: credentials.email,
    name: dto.name,
  });
}
```

Replace with:

```typescript
if (!credentials) {
  credentials = await this.repo.createCredentials({ email: dto.email });
  const payload = { id: credentials.id, email: credentials.email, name: dto.name };
  this.userClient.emit(USER_EVENTS.REGISTERED, payload);
  this.searchClient.emit(USER_EVENTS.REGISTERED, payload);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx nx test @org/auth --testPathPatterns="auth.service.spec" --no-coverage --skipNxCache 2>&1 | grep "Tests:"
```

Expected: all tests green

- [ ] **Step 5: Commit**

```bash
git add libs/backend/auth/src/services/auth.service.ts libs/backend/auth/src/services/auth.service.spec.ts
git commit -m "feat(auth): emit to searchClient on OAuth new user, add oauthLogin tests"
```

---

### Task 3: Unit tests — verifyEmail, forgotPassword, resetPassword

**Files:**

- Modify: `libs/backend/auth/src/services/auth.service.spec.ts`

- [ ] **Step 1: Add the tests**

Add after the `oauthLogin` describe block in `libs/backend/auth/src/services/auth.service.spec.ts`:

```typescript
describe('verifyEmail', () => {
  const token = 'verification-token';
  const credentials = {
    id: 'cred-id',
    email: 'user@example.com',
    role: 'USER' as const,
    isVerified: true,
    passwordHash: null,
  };

  beforeEach(() => {
    mockTokenService.generateAccessToken.mockReturnValue('access');
    mockTokenService.generateRefreshToken.mockReturnValue('refresh');
    mockRepo.saveRefreshToken.mockResolvedValue(undefined);
  });

  it('returns a TokenPair after verifying the email token', async () => {
    mockVerification.verify.mockResolvedValue(credentials.id);
    mockRepo.findById.mockResolvedValue(credentials);

    const result = await service.verifyEmail(token);

    expect(mockVerification.verify).toHaveBeenCalledWith(token);
    expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
  });

  it('throws UnauthorizedException when credentials not found after verification', async () => {
    mockVerification.verify.mockResolvedValue('unknown-id');
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.verifyEmail(token)).rejects.toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });
});

describe('forgotPassword', () => {
  it('calls generatePasswordReset when email exists', async () => {
    mockRepo.findByEmail.mockResolvedValue({
      id: 'cred-id',
      email: 'user@example.com',
      passwordHash: 'hash',
    });
    mockVerification.generatePasswordReset.mockResolvedValue(undefined);

    await service.forgotPassword('user@example.com');

    expect(mockVerification.generatePasswordReset).toHaveBeenCalledWith(
      'cred-id',
      'user@example.com',
    );
  });

  it('does nothing when email is not registered (no info leak)', async () => {
    mockRepo.findByEmail.mockResolvedValue(null);

    await service.forgotPassword('nobody@example.com');

    expect(mockVerification.generatePasswordReset).not.toHaveBeenCalled();
  });

  it('does nothing for OAuth-only accounts (no passwordHash)', async () => {
    mockRepo.findByEmail.mockResolvedValue({
      id: 'cred-id',
      email: 'oauth@example.com',
      passwordHash: null,
    });

    await service.forgotPassword('oauth@example.com');

    expect(mockVerification.generatePasswordReset).not.toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  const token = 'reset-token';
  const newPassword = 'NewPassword1!';
  const credentialsId = 'cred-id';
  const credentials = {
    id: credentialsId,
    email: 'user@example.com',
    role: 'USER',
    isVerified: true,
  };

  beforeEach(() => {
    mockVerification.consumePasswordResetToken.mockResolvedValue(credentialsId);
    mockRepo.findById.mockResolvedValue(credentials);
    mockEncryption.hash.mockResolvedValue('new-hash');
    mockRepo.updatePasswordHash.mockResolvedValue(undefined);
    mockRepo.revokeAllRefreshTokens.mockResolvedValue(undefined);
  });

  it('updates password hash and revokes all refresh tokens', async () => {
    await service.resetPassword(token, newPassword);

    expect(mockEncryption.hash).toHaveBeenCalledWith(newPassword);
    expect(mockRepo.updatePasswordHash).toHaveBeenCalledWith(credentialsId, 'new-hash');
    expect(mockRepo.revokeAllRefreshTokens).toHaveBeenCalledWith(credentialsId);
  });

  it('throws NotFoundException when credentials not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });
});
```

- [ ] **Step 2: Run tests — expect PASS**

```bash
npx nx test @org/auth --testPathPatterns="auth.service.spec" --no-coverage --skipNxCache 2>&1 | grep "Tests:"
```

Expected: all new tests green

- [ ] **Step 3: Commit**

```bash
git add libs/backend/auth/src/services/auth.service.spec.ts
git commit -m "test(auth): add unit tests for verifyEmail, forgotPassword, resetPassword"
```

---

### Task 4: Controller tests — verify-email and resend-verification

**Files:**

- Modify: `apps/backend/gateway/src/controllers/auth.controller.spec.ts`

- [ ] **Step 1: Check the existing test app setup**

Read `apps/backend/gateway/src/test/create-test-app.ts` to understand how `authClient` mock is wired — you'll need the same pattern.

- [ ] **Step 2: Add the tests**

In `apps/backend/gateway/src/controllers/auth.controller.spec.ts`, add after the `reset-password` describe block:

```typescript
describe('GET /api/auth/verify-email', () => {
  it('redirects to /auth/email-verified on valid token', async () => {
    authClient['send'].mockReturnValue(of({ accessToken: 'access', refreshToken: 'refresh' }));

    const res = await request(app.getHttpServer())
      .get('/api/auth/verify-email')
      .query({ token: 'valid-token' });

    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('/auth/email-verified');
  });

  it('sets access_token and refresh_token cookies on success', async () => {
    authClient['send'].mockReturnValue(of({ accessToken: 'access', refreshToken: 'refresh' }));

    const res = await request(app.getHttpServer())
      .get('/api/auth/verify-email')
      .query({ token: 'valid-token' });

    const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('returns 200 and delegates to auth service', async () => {
    authClient['send'].mockReturnValue(of(null));

    const res = await request(app.getHttpServer())
      .post('/api/auth/resend-verification')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/resend-verification').send({});

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
npx nx test @org/gateway --testPathPatterns="auth.controller.spec" --no-coverage --skipNxCache 2>&1 | grep "Tests:"
```

Expected: all tests green

- [ ] **Step 4: Commit**

```bash
git add apps/backend/gateway/src/controllers/auth.controller.spec.ts
git commit -m "test(gateway): add controller tests for verify-email and resend-verification"
```

---

### Task 5: Security review checklist

Manual verification pass — no code to write unless a gap is found.

**Files:**

- Read: `apps/backend/gateway/src/controllers/auth.controller.ts`
- Read: `libs/backend/auth/src/services/auth.service.ts`
- Read: `libs/backend/core/src/token/token.service.ts`

- [ ] **Step 1: JWT payload check**

```bash
grep -n "sub\|role\|isVerified\|email\|password\|passwordHash" libs/backend/core/src/token/token.service.ts
```

Expected: payload contains only `sub`, `role`, `isVerified` — no email, no passwordHash. If email or passwordHash appear, remove them.

- [ ] **Step 2: Password never returned in API responses**

```bash
grep -rn "passwordHash\|password" libs/backend/auth/src/controllers/ libs/backend/user/src/controllers/
```

Expected: no `passwordHash` in controller return values. If found, add `.select()` exclusion in Prisma or map the response.

- [ ] **Step 3: Cookie flags verification**

```bash
grep -A5 "setTokenCookies\|clearTokenCookies" apps/backend/gateway/src/controllers/auth.controller.ts
```

Expected: both methods set `httpOnly: true`, `sameSite: 'strict'`, `secure: NODE_ENV === 'production'`.

- [ ] **Step 4: Timing-safe comparison**

```bash
grep -n "compare\|timingSafe\|bcrypt" libs/backend/core/src/encryption/encryption.service.ts
```

Expected: uses bcrypt `compare()` — bcrypt is inherently constant-time, no fix needed. If plain string comparison is found, replace with `crypto.timingSafeEqual`.

- [ ] **Step 5: Rate limiting coverage**

Confirm ThrottlerGuard covers all auth endpoints globally. The global `APP_GUARD` in `gateway.module.ts` applies to all routes. Per-endpoint limits (register, resend, forgot-password) are covered by the global 100 req/min. Acceptable for MVP.

- [ ] **Step 6: Commit if any fixes were made**

```bash
git add <any fixed files>
git commit -m "fix(auth): security review — <describe what was fixed>"
```

If nothing needed fixing, skip this step.

---

### Task 6: Final verification

- [ ] **Step 1: Run all auth lib tests**

```bash
npx nx test @org/auth --coverage --skipNxCache 2>&1 | grep -E "Tests:|coverage"
```

Expected: all tests PASS

- [ ] **Step 2: Run all gateway tests (our new ones)**

```bash
npx nx test @org/gateway --testPathPatterns="auth.controller.spec|security-headers|rate-limiting|csrf-protection" --no-coverage --skipNxCache 2>&1 | grep "Tests:"
```

Expected: all tests PASS

- [ ] **Step 3: Typecheck auth + gateway**

```bash
npx nx typecheck @org/auth @org/gateway --skipNxCache 2>&1 | grep -E "Successfully|failed"
```

Expected: both pass

---

## Phase 1 Completion Checklist

- [ ] Refresh token reuse detection — revokes ALL tokens on replay
- [ ] OAuth new user emits to searchClient
- [ ] `auth.service.spec.ts` covers all public methods (verifyEmail, forgotPassword, resetPassword, oauthLogin)
- [ ] `auth.controller.spec.ts` covers verify-email and resend-verification
- [ ] JWT payload contains only `sub`, `role`, `isVerified`
- [ ] `passwordHash` never returned in API responses
- [ ] Cookie flags correct: httpOnly, sameSite=strict, secure in production
- [ ] All auth tests pass
