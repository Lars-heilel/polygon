# Session-Based Multi-Device Auth System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bind access/refresh tokens to specific sessions/devices with instant Redis-based revocation

**Architecture:** Each login creates a `Session` in PostgreSQL (source of truth) + Redis (fast cache). JWT tokens carry `sessionId`. `SessionRedisRepository` handles Redis CRUD. `AuthService` updated for session lifecycle (login, refresh, logout, list, revoke). Gateway passes `ClientMetadata` to auth microservice. Frontend shows active sessions in settings.

**Tech Stack:** NestJS, Prisma (PostgreSQL), ioredis (Redis 7), Zustand, React Query, FSD

---
## Global Constraints

- Existing FSD (Feature-Slice Design) for frontend — entities/user, features/auth, pages/settings
- httpOnly cookies for token storage — no localStorage
- SHA-256 hashing for refresh tokens stored in DB
- Existing `ioredis ^5.10.1` with `lazyConnect: true`

---

## File Structure Map

### Create
- `libs/backend/auth/src/cache/session.cache.interface.ts` — `ISessionCacheRepository`
- `libs/backend/auth/src/cache/session.redis.repo.ts` — `SessionRedisRepository`
- `libs/client/entities/user/src/model/session.types.ts` — `SessionInfo` type
- `libs/client/features/auth/src/model/use-sessions.ts` — React Query hook

### Modify
- `libs/backend/auth/src/database/prisma/schema.prisma` — add `lastActiveAt`
- `libs/backend/core/src/token/token.service.ts` — `sessionId` in JwtPayload, `generateTokenPair()`
- `libs/backend/core/src/token/token.service.spec.ts` — test for new method
- `libs/backend/core/src/constants/di/auth.di.ts` — add `SESSION_CACHE_REPOSITORY_TOKEN`
- `libs/backend/core/src/constants/queues/auth.queue.ts` — add patterns
- `libs/backend/auth/src/cache/auth.redis.repo.ts` — rename to `AuthTempTokenRepository`
- `libs/backend/auth/src/cache/auth.cache.interface.ts` — rename interface
- `libs/backend/auth/src/interfaces/auth.interface.ts` — new methods
- `libs/backend/auth/src/services/auth.service.ts` — session lifecycle
- `libs/backend/auth/src/controllers/auth.controller.ts` — new patterns
- `libs/backend/auth/src/lib/auth.module.ts` — new provider
- `apps/backend/gateway/src/controllers/auth.controller.ts` — new endpoints + clientMetadata
- `libs/client/entities/user/src/api/user.api.ts` — session API
- `libs/client/features/auth/src/index.ts` — export useSessions
- `libs/client/pages/messenger/pages-settings/src/lib/settings-devices-tab.tsx` — real data

---

### Task 1: Prisma — Add `lastActiveAt` + Client Regeneration

**Files:**
- Modify: `libs/backend/auth/src/database/prisma/schema.prisma`

- [ ] **Step 1: Update schema**

Add `lastActiveAt  DateTime?` field to `Session` model in `libs/backend/auth/src/database/prisma/schema.prisma`:

```prisma
model Session {
  id            String    @id @default(uuid())
  tokenHash     String    @unique
  credentialsId String
  expiresAt     DateTime
  revokedAt     DateTime?
  lastActiveAt  DateTime?
  ip            String?
  country       String?
  os            String?
  browser       String?
  device        String?
  userAgent     String?
  createdAt     DateTime  @default(now())

  credentials   Credentials @relation(fields: [credentialsId], references: [id], onDelete: Cascade)

  @@index([credentialsId])
}
```

- [ ] **Step 2: Regenerate Prisma client**

Run:
```bash
npx nx run @org/auth:prisma-generate
```

Expected: Prisma client generated in `libs/backend/auth/src/database/prisma/generated/prisma/`

---

### Task 2: @org/common — Add `SessionInfo` Schema

**Files:**
- Create: Need to add Session type to common lib
- Actually, modify: `libs/common/src/schemas/auth/session.schema.ts`

- [ ] **Step 1: Create Session schema**

Create `libs/common/src/schemas/auth/session.schema.ts`:

```ts
import * as z from 'zod';

export const sessionSchema = z.object({
  id: z.string().uuid(),
  device: z.string().nullable(),
  os: z.string().nullable(),
  browser: z.string().nullable(),
  ip: z.string().nullable(),
  country: z.string().nullable(),
  isCurrent: z.boolean(),
  lastActiveAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type SessionInfo = z.infer<typeof sessionSchema>;
```

- [ ] **Step 2: Export from common**

Add to `libs/common/src/schemas/auth/index.ts`:
```ts
export * from './session.schema';
```

Also remove `refresh-token.schema.ts` export (replaced by session):
```ts
// Remove: export * from './refresh-token.schema';
```

- [ ] **Step 3: Check no other code imports `RefreshToken` from `@org/common`**

Search for usages:
```bash
rg "from '@org/common'" --type ts | rg -i "RefreshToken"
```

If nothing imports it, safe to remove. If something does, keep the export but add a deprecation notice.

---

### Task 3: @org/core — Update TokenService (`sessionId` + `generateTokenPair`)

**Files:**
- Modify: `libs/backend/core/src/token/token.service.ts`
- Modify: `libs/backend/core/src/token/token.service.spec.ts`

- [ ] **Step 1: Add `sessionId` to `JwtPayload`**

```ts
export type JwtPayload = {
  sub: string;
  role: Role;
  isVerified: boolean;
  sessionId: string;
  jti: string;
};
```

- [ ] **Step 2: Add `generateTokenPair` method**

```ts
generateTokenPair(payload: Omit<JwtPayload, 'jti' | 'sessionId'>, sessionId: string): TokenPair {
  const jti = randomUUID();
  const fullPayload: JwtPayload = { ...payload, sessionId, jti };
  const accessToken = this.jwt.sign(fullPayload, {
    secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    expiresIn: this.config.get('JWT_ACCESS_TOKEN_EXPIRES', { infer: true }),
  });
  const refreshJti = randomUUID();
  const refreshPayload: JwtPayload = { ...payload, sessionId, jti: refreshJti };
  const refreshToken = this.jwt.sign(refreshPayload, {
    secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
    expiresIn: this.config.get('JWT_REFRESH_TOKEN_EXPIRES', { infer: true }),
  });
  return { accessToken, refreshToken };
}
```

Add import: `import { randomUUID } from 'crypto';`

- [ ] **Step 3: Update tests**

In `token.service.spec.ts`:
- Add test `generateTokenPair returns a TokenPair with matching sessionId`
- Update existing tests that create `JwtPayload` — add `sessionId: 'test-session-id'`

---

### Task 4: @org/core — Add DI Token + AUTH_PATTERNS

- [ ] **Step 1: Add `SESSION_CACHE_REPOSITORY_TOKEN`**

In `libs/backend/core/src/constants/di/auth.di.ts`:

```ts
export const SESSION_CACHE_REPOSITORY_TOKEN = 'SESSION_CACHE_REPOSITORY_TOKEN';
```

- [ ] **Step 2: Add new AUTH_PATTERNS**

In `libs/backend/core/src/constants/queues/auth.queue.ts`:

```ts
export const AUTH_PATTERNS = {
  REGISTER: 'auth.register',
  VALIDATE_CREDENTIALS: 'auth.validate-credentials',
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REFRESH: 'auth.refresh',
  VERIFY_EMAIL: 'auth.verify-email',
  RESEND_VERIFICATION: 'auth.resend-verification',
  FORGOT_PASSWORD: 'auth.forgot-password',
  RESET_PASSWORD: 'auth.reset-password',
  OAUTH_LOGIN: 'auth.oauth-login',
  LIST_SESSIONS: 'auth.list-sessions',
  REVOKE_SESSION: 'auth.revoke-session',
  REVOKE_ALL_SESSIONS: 'auth.revoke-all-sessions',
} as const;
```

---

### Task 5: @org/auth — Rename AuthRedisCacheRepository to AuthTempTokenRepository

**Files:**
- Modify: `libs/backend/auth/src/cache/auth.cache.interface.ts` — rename `IAuthCacheRepository` → `IAuthTempTokenRepository`
- Modify: `libs/backend/auth/src/cache/auth.redis.repo.ts` — rename class + file
- Modify: `libs/backend/auth/src/services/auth.service.ts` — rename DI reference
- Modify: `libs/backend/auth/src/services/verification.service.ts` — rename DI reference
- Modify: `libs/backend/auth/src/lib/auth.module.ts` — rename provider

- [ ] **Step 1: Rename interface**

In `libs/backend/auth/src/cache/auth.cache.interface.ts`:
```ts
export interface IAuthTempTokenRepository {
  // ... same methods as before
}
```

- [ ] **Step 2: Rename class + file**

Rename `auth.redis.repo.ts` to `auth-temp-token.repository.ts`. In the file:
```ts
export class AuthTempTokenRepository implements IAuthTempTokenRepository {
  // ... same implementation
}
```

- [ ] **Step 3: Update token references**

In `@org/core` DI constants, rename `AUTH_CACHE_REPOSITORY_TOKEN` → `AUTH_TEMP_TOKEN_REPOSITORY_TOKEN` (or keep old token but use new class). Simpler: keep DI token name but change class.

Actually, simplest approach: keep the DI token `AUTH_CACHE_REPOSITORY_TOKEN` unchanged, just rename the class. That minimizes changes.

Let's just rename:
- `IAuthCacheRepository` → rename to `IAuthTempTokenRepository`
- `AuthRedisCacheRepository` → rename to `AuthTempTokenRepository`
- Update all imports

---

### Task 6: @org/auth — Create SessionRedisRepository

**Files:**
- Create: `libs/backend/auth/src/cache/session.cache.interface.ts`
- Create: `libs/backend/auth/src/cache/session.redis.repo.ts`

- [ ] **Step 1: Create interface `ISessionCacheRepository`**

```ts
export interface SessionCacheData {
  credentialsId: string;
  device: string;
  expiresAt: string;
}

export interface ISessionCacheRepository {
  save(sessionId: string, data: SessionCacheData, ttlSec: number): Promise<void>;
  find(sessionId: string): Promise<SessionCacheData | null>;
  remove(sessionId: string): Promise<void>;
  addToUserSessions(userId: string, sessionId: string): Promise<void>;
  getUserSessionIds(userId: string): Promise<string[]>;
  removeFromUserSessions(userId: string, sessionId: string): Promise<void>;
}
```

- [ ] **Step 2: Create implementation `SessionRedisRepository`**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@org/core';
import type Redis from 'ioredis';
import type { ISessionCacheRepository, SessionCacheData } from './session.cache.interface';

const KEY = {
  session: (id: string) => `session:${id}`,
  userSessions: (userId: string) => `user_sessions:${userId}`,
};

@Injectable()
export class SessionRedisRepository implements ISessionCacheRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async save(sessionId: string, data: SessionCacheData, ttlSec: number): Promise<void> {
    await this.redis.set(KEY.session(sessionId), JSON.stringify(data), 'EX', ttlSec);
  }

  async find(sessionId: string): Promise<SessionCacheData | null> {
    const raw = await this.redis.get(KEY.session(sessionId));
    return raw ? JSON.parse(raw) : null;
  }

  async remove(sessionId: string): Promise<void> {
    await this.redis.del(KEY.session(sessionId));
  }

  async addToUserSessions(userId: string, sessionId: string): Promise<void> {
    await this.redis.sadd(KEY.userSessions(userId), sessionId);
  }

  async getUserSessionIds(userId: string): Promise<string[]> {
    return this.redis.smembers(KEY.userSessions(userId));
  }

  async removeFromUserSessions(userId: string, sessionId: string): Promise<void> {
    await this.redis.srem(KEY.userSessions(userId), sessionId);
  }
}
```

---

### Task 7: @org/auth — Update Interfaces and DI

**Files:**
- Modify: `libs/backend/auth/src/interfaces/auth.interface.ts`
- Modify: `libs/backend/auth/src/lib/auth.module.ts`
- Modify: `libs/backend/core/src/index.ts` — export new DI token

- [ ] **Step 1: Update `IAuthRepository`**

Rename refresh token methods to session methods:
```ts
export interface IAuthRepository {
  // ... existing methods
  saveSession(data: { id: string; tokenHash: string; credentialsId: string; expiresAt: Date; ip?: string; country?: string; os?: string; browser?: string; device?: string; userAgent?: string }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<Session | null>;
  revokeSession(tokenHash: string): Promise<void>;
  revokeAllSessions(credentialsId: string): Promise<void>;
  findActiveSessions(credentialsId: string): Promise<Session[]>;
  findSessionById(sessionId: string): Promise<Session | null>;
  updateSessionLastActive(sessionId: string): Promise<void>;
  // Remove old methods:
  // saveRefreshToken
  // findRefreshToken
  // revokeRefreshToken
  // revokeAllRefreshTokens
}
```

- [ ] **Step 2: Update `IAuthService`**

Add new methods:
```ts
export interface IAuthService {
  // ... existing methods (register, validateCredentials, login, logout, refresh, etc.)
  login(id: string, clientMetadata: ClientMetadata): Promise<TokenPair>;
  listSessions(credentialsId: string, currentSessionId: string): Promise<SessionInfo[]>;
  revokeSession(sessionId: string, credentialsId: string): Promise<void>;
  revokeAllSessions(credentialsId: string): Promise<void>;
}
```

Change `login` signature to accept `clientMetadata`.

- [ ] **Step 3: Update `IAuthController`**

Add new handlers:
```ts
export interface IAuthController {
  listSessions(payload: { credentialsId: string; currentSessionId: string }): Promise<SessionInfo[]>;
  revokeSession(payload: { sessionId: string; credentialsId: string }): Promise<null>;
  revokeAllSessions(payload: { credentialsId: string }): Promise<null>;
}
```

- [ ] **Step 4: Register SessionRedisRepository in module**

In `libs/backend/auth/src/lib/auth.module.ts`:
```ts
import { SESSION_CACHE_REPOSITORY_TOKEN } from '@org/core';
import { SessionRedisRepository } from '../cache/session.redis.repo';

// in providers:
{ provide: SESSION_CACHE_REPOSITORY_TOKEN, useClass: SessionRedisRepository },
```

- [ ] **Step 5: Export from @org/core**

Add to `libs/backend/core/src/index.ts`:
```ts
export * from './constants/di/auth.di';
// Already there, SESSION_CACHE_REPOSITORY_TOKEN is added to auth.di.ts
```

---

### Task 8: @org/auth — Update AuthService (Login with session + clientMetadata)

**Files:**
- Modify: `libs/backend/auth/src/services/auth.service.ts`

- [ ] **Step 1: Add imports and new dependencies**

```ts
import type { ClientMetadata } from '@org/core';
import { SESSION_CACHE_REPOSITORY_TOKEN } from '@org/core';
import type { ISessionCacheRepository } from '../cache/session.cache.interface';
```

Add to constructor:
```ts
@Inject(SESSION_CACHE_REPOSITORY_TOKEN)
private readonly sessionCache: ISessionCacheRepository,
```

- [ ] **Step 2: Update `login` method**

```ts
async login(id: string, clientMetadata?: ClientMetadata): Promise<TokenPair> {
  const credentials = await this.repo.findById(id);
  if (!credentials) throw new UnauthorizedException();

  const expiresAt = new Date(
    Date.now() + this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true }) * 1000,
  );
  const ttlSec = this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true });

  const sessionId = randomUUID();

  // Generate tokens first (need sessionId)
  const jwtPayload = {
    sub: credentials.id,
    role: credentials.role as JwtPayload['role'],
    isVerified: credentials.isVerified,
  };
  const tokens = this.tokenService.generateTokenPair(jwtPayload, sessionId);
  const tokenHash = this.hashToken(tokens.refreshToken);

  // Create session in PG with final tokenHash
  await this.repo.saveSession({
    id: sessionId,
    tokenHash,
    credentialsId: credentials.id,
    expiresAt,
    ip: clientMetadata?.ip,
    country: clientMetadata?.country,
    os: clientMetadata?.os,
    browser: clientMetadata?.browser,
    device: clientMetadata?.device,
    userAgent: clientMetadata?.userAgent,
  });

  // Save to Redis
  await this.sessionCache.save(sessionId, {
    credentialsId: credentials.id,
    device: clientMetadata?.device ?? 'Unknown',
    expiresAt: expiresAt.toISOString(),
  }, ttlSec);
  await this.sessionCache.addToUserSessions(credentials.id, sessionId);

  return tokens;
}
```

Add import: `import { randomUUID } from 'crypto';`

- [ ] **Step 3: Update `refresh` method**

Key design: refresh rotates the token pair (new jti, new tokenHash) but keeps the same `sessionId`. The PG record is **updated in-place** with the new tokenHash (not revoked+created).

```ts
async refresh(refreshToken: string): Promise<TokenPair> {
  let payload: JwtPayload;
  try {
    payload = this.tokenService.verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedException();
  }

  const tokenHash = this.hashToken(refreshToken);
  const stored = await this.repo.findSessionByTokenHash(tokenHash);
  if (!stored) throw new UnauthorizedException();

  // Replay attack: old token reused after rotation → hash not found → 401 (implicit)
  if (stored.revokedAt) {
    await this.repo.revokeAllSessions(stored.credentialsId);
    throw new UnauthorizedException();
  }
  if (stored.expiresAt < new Date()) throw new UnauthorizedException();

  // Rotate tokens with same sessionId
  const jwtPayload = {
    sub: payload.sub,
    role: payload.role,
    isVerified: payload.isVerified,
  };
  const newTokens = this.tokenService.generateTokenPair(jwtPayload, stored.id);
  const newTokenHash = this.hashToken(newTokens.refreshToken);

  // Update the same session record with new tokenHash
  await this.repo.updateSessionTokenHash(stored.id, newTokenHash);

  // Update Redis TTL
  const ttlSec = this.config.getOrThrow('JWT_REFRESH_TOKEN_EXPIRES', { infer: true });
  await this.sessionCache.save(stored.id, {
    credentialsId: stored.credentialsId,
    device: stored.device ?? 'Unknown',
    expiresAt: stored.expiresAt.toISOString(),
  }, ttlSec);
  await this.repo.updateSessionLastActive(stored.id);

  return newTokens;
}
```

- [ ] **Step 4: Update `logout` method**

```ts
async logout(refreshToken: string): Promise<void> {
  let payload: JwtPayload;
  try {
    payload = this.tokenService.verifyRefreshToken(refreshToken);
  } catch {
    return;
  }

  const tokenHash = this.hashToken(refreshToken);
  await this.repo.revokeSession(tokenHash);
  await this.sessionCache.remove(payload.sessionId);
  await this.sessionCache.removeFromUserSessions(payload.sub, payload.sessionId);
}
```

- [ ] **Step 5: Update `verifyEmail` to accept clientMetadata**

```ts
async verifyEmail(token: string, clientMetadata?: ClientMetadata): Promise<TokenPair> {
  const credentialsId = await this.verification.verify(token);
  const credentials = await this.repo.findById(credentialsId);
  if (!credentials) throw new UnauthorizedException();
  return this.login(credentials.id, clientMetadata);
}
```

- [ ] **Step 6: Update `oauthLogin` to accept clientMetadata**

```ts
async oauthLogin(dto: OAuthLoginDto, clientMetadata?: ClientMetadata): Promise<TokenPair> {
  const existing = await this.repo.findOAuthAccount(dto.provider, dto.providerId);
  if (existing) return this.login(existing.credentials.id, clientMetadata);
  // ... rest of existing OAuth logic, then:
  return this.login(credentials.id, clientMetadata);
}
```

- [ ] **Step 7: Implement `listSessions`, `revokeSession`, `revokeAllSessions`**

```ts
async listSessions(credentialsId: string, currentSessionId: string): Promise<SessionInfo[]> {
  const sessions = await this.repo.findActiveSessions(credentialsId);
  return sessions.map((s) => ({
    id: s.id,
    device: s.device,
    os: s.os,
    browser: s.browser,
    ip: s.ip,
    country: s.country,
    isCurrent: s.id === currentSessionId,
    lastActiveAt: s.lastActiveAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));
}

async revokeSession(sessionId: string, credentialsId: string): Promise<void> {
  const session = await this.repo.findSessionById(sessionId);
  if (!session || session.credentialsId !== credentialsId) {
    throw new UnauthorizedException();
  }
  await this.repo.revokeSession(session.tokenHash);
  await this.sessionCache.remove(sessionId);
  await this.sessionCache.removeFromUserSessions(credentialsId, sessionId);
}

async revokeAllSessions(credentialsId: string): Promise<void> {
  const sessionIds = await this.sessionCache.getUserSessionIds(credentialsId);
  for (const sid of sessionIds) {
    await this.sessionCache.remove(sid);
  }
  await this.sessionCache.remove(credentialsId); // remove the set key
  await this.repo.revokeAllSessions(credentialsId);
}
```

---

### Task 9: @org/auth — Update Controller + Prisma Repository

**Files:**
- Modify: `libs/backend/auth/src/controllers/auth.controller.ts`
- Modify: `libs/backend/auth/src/database/repository/auth.prisma.repo.ts`

- [ ] **Step 1: Add new message patterns to controller**

```ts
@MessagePattern(AUTH_PATTERNS.LIST_SESSIONS)
listSessions(@Payload() payload: { credentialsId: string; currentSessionId: string }): Promise<SessionInfo[]> {
  return this.authService.listSessions(payload.credentialsId, payload.currentSessionId);
}

@MessagePattern(AUTH_PATTERNS.REVOKE_SESSION)
revokeSession(@Payload() payload: { sessionId: string; credentialsId: string }): Promise<null> {
  return this.authService.revokeSession(payload.sessionId, payload.credentialsId).then(() => null);
}

@MessagePattern(AUTH_PATTERNS.REVOKE_ALL_SESSIONS)
revokeAllSessions(@Payload() payload: { credentialsId: string }): Promise<null> {
  return this.authService.revokeAllSessions(payload.credentialsId).then(() => null);
}
```

Update existing `login` handler to accept `clientMetadata`:
```ts
@MessagePattern(AUTH_PATTERNS.LOGIN)
login(@Payload() payload: { id: string; clientMetadata?: ClientMetadata }): Promise<TokenPair> {
  return this.authService.login(payload.id, payload.clientMetadata);
}
```

- [ ] **Step 2: Update Prisma repository**

Replace old refresh token methods with session methods in `auth.prisma.repo.ts`:

```ts
async saveSession(data: { id: string; tokenHash: string; credentialsId: string; expiresAt: Date; ip?: string; country?: string; os?: string; browser?: string; device?: string; userAgent?: string }): Promise<void> {
  try { await this.prisma.session.create({ data }); }
  catch (error) { handlePrismaError(error); }
}

async findSessionByTokenHash(tokenHash: string): Promise<any | null> {
  return this.prisma.session.findUnique({ where: { tokenHash } });
}

async revokeSession(tokenHash: string): Promise<void> {
  try { await this.prisma.session.update({ where: { tokenHash }, data: { revokedAt: new Date() } }); }
  catch (error) { handlePrismaError(error); }
}

async revokeAllSessions(credentialsId: string): Promise<void> {
  await this.prisma.session.updateMany({
    where: { credentialsId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async updateSessionTokenHash(sessionId: string, newTokenHash: string): Promise<void> {
  try { await this.prisma.session.update({ where: { id: sessionId }, data: { tokenHash: newTokenHash } }); }
  catch (error) { handlePrismaError(error); }
}

async findActiveSessions(credentialsId: string): Promise<any[]> {
  return this.prisma.session.findMany({
    where: { credentialsId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

async findSessionById(sessionId: string): Promise<any | null> {
  return this.prisma.session.findUnique({ where: { id: sessionId } });
}

async updateSessionLastActive(sessionId: string): Promise<void> {
  try { await this.prisma.session.update({ where: { id: sessionId }, data: { lastActiveAt: new Date() } }); }
  catch (error) { handlePrismaError(error); }
}
```

Remove old methods: `saveRefreshToken`, `findRefreshToken`, `revokeRefreshToken`, `revokeAllRefreshTokens`.

Also update `resetPassword` in auth service to call `revokeAllSessions` instead of `revokeAllRefreshTokens`.

---

### Task 10: Gateway — Update AuthController

**Files:**
- Modify: `apps/backend/gateway/src/controllers/auth.controller.ts`

- [ ] **Step 1: Pass clientMetadata to login**

```ts
@Post('login')
async login(
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response,
  @GetClientMetadata() metadata: ClientMetadata,
) {
  const credentials = req.user as CredentialsPayload;
  const tokens = await this.send<TokenPair>(
    this.authClient.send(AUTH_PATTERNS.LOGIN, {
      id: credentials.id,
      clientMetadata: metadata,
    }),
  );
  this.setTokenCookies(res, tokens);
  return { message: 'Logged in successfully' };
}
```

- [ ] **Step 2: Pass clientMetadata to verifyEmail**

```ts
@Get('verify-email')
async verifyEmail(
  @Query('token') token: string,
  @GetClientMetadata() metadata: ClientMetadata,
  @Res() res: Response,
) {
  const tokens = await this.send<TokenPair>(
    this.authClient.send(AUTH_PATTERNS.VERIFY_EMAIL, { token, clientMetadata: metadata }),
  );
  this.setTokenCookies(res, tokens);
  const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });
  res.redirect(`${clientUrl}/auth/email-verified`);
}
```

- [ ] **Step 3: Pass clientMetadata to OAuth callbacks**

```ts
@Get('github/callback')
@UseGuards(GithubGuard)
githubCallback(
  @Req() req: Request & { user: TokenPair },
  @GetClientMetadata() metadata: ClientMetadata,
  @Res() res: Response,
) {
  // TODO: Need to capture clientMetadata BEFORE OAuth redirect.
  // For now, OAuth flow loses clientMetadata — will be handled via refresh on first API call.
  this.setTokenCookies(res, req.user);
  const clientUrl = this.config.getOrThrow('CLIENT_URL', { infer: true });
  res.redirect(clientUrl);
}
```

Note: OAuth flow uses full-page redirect, so client metadata is lost. Accept this limitation for now — the session will be created with minimal metadata.

- [ ] **Step 4: Add session management endpoints**

```ts
@Get('sessions')
@UseGuards(JwtGuard)
@ApiOperation({ summary: 'List active sessions for current user' })
async listSessions(@Req() req: Request) {
  const jwtPayload = req.user as JwtPayload;
  const sessions = await this.send<SessionInfo[]>(
    this.authClient.send(AUTH_PATTERNS.LIST_SESSIONS, {
      credentialsId: jwtPayload.sub,
      currentSessionId: jwtPayload.sessionId,
    }),
  );
  return sessions;
}

@Delete('sessions/:id')
@UseGuards(JwtGuard)
@ApiOperation({ summary: 'Revoke a specific session' })
async revokeSession(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const jwtPayload = req.user as JwtPayload;
  await this.send(
    this.authClient.send(AUTH_PATTERNS.REVOKE_SESSION, {
      sessionId: id,
      credentialsId: jwtPayload.sub,
    }),
  );
  if (id === jwtPayload.sessionId) {
    this.clearTokenCookies(res);
  }
  return { message: 'Session revoked' };
}

@Delete('sessions')
@UseGuards(JwtGuard)
@ApiOperation({ summary: 'Revoke all sessions' })
async revokeAllSessions(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const jwtPayload = req.user as JwtPayload;
  await this.send(
    this.authClient.send(AUTH_PATTERNS.REVOKE_ALL_SESSIONS, {
      credentialsId: jwtPayload.sub,
    }),
  );
  this.clearTokenCookies(res);
  return { message: 'All sessions revoked' };
}
```

Add imports:
```ts
import { JwtGuard, JwtPayload } from '@org/core';
import { SessionInfo } from '@org/common';
import { Param } from '@nestjs/common';
```

---

### Task 11: @org/auth — Update AuthServiceImpl Patterns (login, verifyEmail, oauthLogin in microservice controller)

**Files:**
- Modify: `libs/backend/auth/src/services/auth.service.ts`

Already covered in Task 8. Ensure the changes to `verifyEmail` and `oauthLogin` propagate through the controller:

In `auth.controller.ts` (microservice):
```ts
@MessagePattern(AUTH_PATTERNS.VERIFY_EMAIL)
verifyEmail(@Payload() payload: { token: string; clientMetadata?: ClientMetadata }): Promise<TokenPair> {
  return this.authService.verifyEmail(payload.token, payload.clientMetadata);
}
```

```ts
@MessagePattern(AUTH_PATTERNS.OAUTH_LOGIN)
oauthLogin(@Payload() dto: OAuthLoginDto & { clientMetadata?: ClientMetadata }): Promise<TokenPair> {
  return this.authService.oauthLogin(dto, dto.clientMetadata);
}
```

Also update the gateway controller's OAuth flow. Since OAuth loses the metadata (redirect), we just pass `undefined` and the session gets minimal data.

---

### Task 12: Frontend — Session Types + API

**Files:**
- Create: `libs/client/entities/user/src/model/session.types.ts`
- Modify: `libs/client/entities/user/src/api/user.api.ts`
- Modify: `libs/client/entities/user/src/index.ts`
- Modify: `libs/common/src/schemas/auth/index.ts` (already done in Task 2)

- [ ] **Step 1: Create session types**

```ts
// libs/client/entities/user/src/model/session.types.ts
export interface SessionInfo {
  id: string;
  device: string | null;
  os: string | null;
  browser: string | null;
  ip: string | null;
  country: string | null;
  isCurrent: boolean;
  lastActiveAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Add API methods**

In `libs/client/entities/user/src/api/user.api.ts`:

```ts
import { authedFetch } from '@org/shared';
import type { SessionInfo } from '../model/session.types';

export const authApi = {
  // ... existing methods

  async getSessions(): Promise<SessionInfo[]> {
    return authedFetch<SessionInfo[]>('auth/sessions');
  },

  async revokeSession(sessionId: string): Promise<void> {
    await authedFetch(`auth/sessions/${sessionId}`, { method: 'DELETE' });
  },

  async revokeAllSessions(): Promise<void> {
    await authedFetch('auth/sessions', { method: 'DELETE' });
  },
};
```

- [ ] **Step 3: Export from index**

Ensure `session.types.ts` is exported from `libs/client/entities/user/src/index.ts`.

---

### Task 13: Frontend — `useSessions` Hook

**Files:**
- Create: `libs/client/features/auth/src/model/use-sessions.ts`
- Modify: `libs/client/features/auth/src/index.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@org/entities-user';
import { useSessionStore } from '@org/entities-user';
import { useNavigate } from 'react-router-dom';

export function useSessions() {
  const queryClient = useQueryClient();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);
  const navigate = useNavigate();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: authApi.getSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const revokeAllMutation = useMutation({
    mutationFn: authApi.revokeAllSessions,
    onSuccess: () => {
      setAuthenticated(false);
      navigate('/auth/login');
    },
  });

  return {
    sessions,
    isLoading,
    revokeSession: (sessionId: string) => revokeMutation.mutateAsync(sessionId),
    revokeAllSessions: () => revokeAllMutation.mutateAsync(),
    isRevoking: revokeMutation.isPending,
    isRevokingAll: revokeAllMutation.isPending,
  };
}
```

- [ ] **Step 2: Export from features/auth**

In `libs/client/features/auth/src/index.ts`:
```ts
export { useSessions } from './model/use-sessions';
```

---

### Task 14: Frontend — SettingsDevicesTab

**Files:**
- Modify: `libs/client/pages/messenger/pages-settings/src/lib/settings-devices-tab.tsx`

- [ ] **Step 1: Replace hardcoded data with real data**

```tsx
import { useSessions } from '@org/features-auth';
import { Button, Text } from '@org/shared';

export function SettingsDevicesTab() {
  const { sessions, isLoading, revokeSession, revokeAllSessions, isRevokingAll } = useSessions();

  if (isLoading) {
    return <Text>Loading sessions...</Text>;
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <div key={session.id} className="p-4 bg-surface-elevated rounded-lg flex items-center gap-3">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={session.isCurrent
                ? "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                : "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              }
            />
          </svg>
          <div className="flex-1">
            <Text size="sm" weight="medium">
              {session.browser || 'Unknown'} on {session.os || 'Unknown'}
            </Text>
            <Text size="xs" color="muted">
              {session.lastActiveAt
                ? `Last active ${formatRelativeTime(session.lastActiveAt)}`
                : `Created ${formatRelativeTime(session.createdAt)}`
              }
              {session.ip ? ` · ${session.ip}` : ''}
              {session.country ? ` · ${session.country}` : ''}
            </Text>
          </div>
          {session.isCurrent ? (
            <span className="text-xs text-green-500">Current device</span>
          ) : (
            <button
              className="text-xs text-danger hover:underline"
              onClick={() => revokeSession(session.id)}
            >
              Logout
            </button>
          )}
        </div>
      ))}
      <Button
        variant="danger"
        className="w-full"
        onClick={revokeAllSessions}
        disabled={isRevokingAll}
      >
        {isRevokingAll ? 'Logging out...' : 'Logout from all devices'}
      </Button>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}
```

Add import for `useNavigate` if needed. Also check that `@org/shared` exports `Text` and `Button`.

---

### Task 15: Build & Verify

- [ ] **Step 1: Check TypeScript compilation**

```bash
npx nx run @org/auth:typecheck
npx nx run @org/core:typecheck
npx nx run gateway:typecheck
npx nx run client:typecheck
```

- [ ] **Step 2: Run auth tests**

```bash
npx nx run @org/auth:test
npx nx run @org/core:test --testFile=token.service.spec.ts
```

- [ ] **Step 3: Fix any issues**

Iterate on any compilation or test failures.
