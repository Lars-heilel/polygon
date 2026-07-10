# Admin Service MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first administrative workflow as a separate `/admin` React SPA, backed by Gateway orchestration over the existing Auth, User, Search, and Media services, with immediate HTTP and WebSocket ban enforcement.

**Architecture:** Shared Zod contracts define the Admin API and Auth RPC payloads. Auth remains the owner of roles, OAuth identities, sessions, and ban state; the Gateway authorizes administrators, aggregates domain data, checks Redis ban markers on every protected request and socket connection, and disconnects a target after a successful ban. The new Admin SPA uses the existing shared UI/API/session packages and remains a separate Nx application served below `/admin`.

**Tech Stack:** Nx, TypeScript, NestJS, Prisma/PostgreSQL, ioredis, RabbitMQ `ClientProxy`, Socket.IO, React 19, React Router, TanStack Query, Zod, Vitest/Jest, Testing Library, Supertest, Vite, Nginx.

---

## File map

- `libs/common/src/schemas/admin/*.ts`: canonical durations, reasons, ban payloads, summaries, details, and query schemas.
- `libs/common/src/constants/routes.ts`: Admin HTTP route builders and `/admin` client routes.
- `libs/backend/core/src/constants/queues/auth.queue.ts`: Auth administrative RPC patterns.
- `libs/backend/core/src/ban/*`: Redis ban marker repository and reusable HTTP enforcement guard.
- `libs/backend/auth/src/admin/*`: hierarchy policy, duration/reason resolution, and ban application service.
- `libs/backend/auth/src/database/*`: additive Prisma migration and repository persistence operations.
- `apps/backend/gateway/src/controllers/admin.controller.ts`: protected `/api/admin` orchestration endpoints.
- `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`: connection-time marker enforcement and target disconnect API.
- `apps/client/admin/*`: standalone Admin SPA shell, guards, routing, and providers.
- `libs/client/entities/admin/*`: Admin API types, query keys, and data hooks.
- `libs/client/features/admin-ban/*`: validated ban dialog and mutations.
- `libs/client/pages/admin/*`: overview, user list, user detail, and Admin 404 slices.
- `libs/client/pages/messenger/pages-settings/*`: role-gated full-navigation Admin link.

### Task 1: Define shared Admin contracts

**Files:**
- Create: `libs/common/src/schemas/admin/admin-ban.schema.ts`
- Create: `libs/common/src/schemas/admin/admin-user.schema.ts`
- Create: `libs/common/src/schemas/admin/index.ts`
- Modify: `libs/common/src/schemas/index.ts`
- Modify: `libs/common/src/constants/routes.ts`
- Test: `libs/common/src/schemas/admin/admin-ban.schema.spec.ts`

- [ ] **Step 1: Write failing schema tests**

```ts
import { adminBanRequestSchema } from './admin-ban.schema';

describe('adminBanRequestSchema', () => {
  it.each(['ONE_HOUR', 'ONE_DAY', 'SEVEN_DAYS', 'THIRTY_DAYS', 'PERMANENT'])('accepts %s', (duration) => {
    expect(adminBanRequestSchema.safeParse({ duration, reason: 'SPAM' }).success).toBe(true);
  });

  it('requires a trimmed 5-500 character custom reason', () => {
    expect(adminBanRequestSchema.safeParse({ duration: 'ONE_DAY', reason: 'CUSTOM', customReason: ' no ' }).success).toBe(false);
    expect(adminBanRequestSchema.parse({ duration: 'ONE_DAY', reason: 'CUSTOM', customReason: '  repeated abuse  ' }).customReason).toBe('repeated abuse');
  });

  it('rejects custom text for a preset reason', () => {
    expect(adminBanRequestSchema.safeParse({ duration: 'ONE_DAY', reason: 'SPAM', customReason: 'ignored text' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the common tests and confirm the missing-module failure**

Run: `npm exec nx test @org/common -- --runInBand`

Expected: FAIL because `admin-ban.schema.ts` does not exist.

- [ ] **Step 3: Implement canonical contracts**

```ts
// admin-ban.schema.ts
import * as z from 'zod';

export const adminBanDurationSchema = z.enum(['ONE_HOUR', 'ONE_DAY', 'SEVEN_DAYS', 'THIRTY_DAYS', 'PERMANENT']);
export const adminBanReasonSchema = z.enum(['SPAM', 'BULLYING', 'UNACCEPTABLE_CONTENT', 'SUSPICIOUS_ACTIVITY', 'CUSTOM']);
export const adminBanRequestSchema = z.discriminatedUnion('reason', [
  z.object({ duration: adminBanDurationSchema, reason: z.literal('CUSTOM'), customReason: z.string().trim().min(5).max(500) }),
  z.object({ duration: adminBanDurationSchema, reason: adminBanReasonSchema.exclude(['CUSTOM']), customReason: z.never().optional() }),
]);
export const adminBanStateSchema = z.object({ isBanned: z.boolean(), bannedUntil: z.coerce.date().nullable(), banReason: z.string().nullable(), bannedAt: z.coerce.date().nullable(), bannedBy: z.string().nullable() });
export type AdminBanRequest = z.infer<typeof adminBanRequestSchema>;
export type AdminBanState = z.infer<typeof adminBanStateSchema>;
```

Define in `admin-user.schema.ts` the exact aggregated response: `id`, `email`, `role`, `profile`, `oauthProviders`, `avatarHistory`, `sessionSummary`, and `ban`; reuse existing User, Role, and Session schemas instead of duplicating fields. Add `adminUserQuerySchema = z.object({ query: z.string().trim().min(1).max(100) })`, list result, detail, and session response schemas, then export them from both index files.

Add route builders:

```ts
admin: {
  users: 'admin/users',
  user: (id: string) => `admin/users/${id}`,
  sessions: (id: string) => `admin/users/${id}/sessions`,
  session: (id: string, sessionId: string) => `admin/users/${id}/sessions/${sessionId}`,
  ban: (id: string) => `admin/users/${id}/ban`,
},
```

and client routes `admin.root`, `admin.users`, `admin.user(id)`, and `admin.notFound`.

- [ ] **Step 4: Run tests, lint, and typecheck**

Run: `npm exec nx test @org/common -- --runInBand && npm exec nx lint @org/common && npm exec nx typecheck @org/common`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/common/src
git commit -m "feat(common): define admin contracts"
```

### Task 2: Add Auth ban persistence with a safe migration

**Files:**
- Modify: `libs/backend/auth/src/database/prisma/schema.prisma`
- Create: `libs/backend/auth/src/database/prisma/migrations/20260708120000_add_credentials_ban/migration.sql`
- Modify: `libs/backend/auth/src/interfaces/auth.interface.ts`
- Modify: `libs/backend/auth/src/database/repository/auth.prisma.repo.ts`
- Test: `libs/backend/auth/src/database/repository/auth.prisma.repo.spec.ts`

- [ ] **Step 1: Write repository tests**

Test that `setBan()` updates only the five ban columns, `clearBan()` nulls all metadata and sets `isBanned: false`, `findAdminAccount()` selects role/OAuth/ban data, and `revokeAllSessions()` only touches active target sessions.

```ts
expect(prisma.credentials.update).toHaveBeenCalledWith({
  where: { id: 'target' },
  data: { isBanned: true, bannedUntil, banReason: 'Spam', bannedAt, bannedBy: 'actor' },
});
```

- [ ] **Step 2: Verify failure**

Run: `npm exec nx test @org/auth -- --runInBand --testPathPattern=auth.prisma.repo.spec.ts`

Expected: FAIL because ban repository methods do not exist.

- [ ] **Step 3: Add the model fields and repository API**

```prisma
isBanned    Boolean   @default(false) @map("is_banned")
bannedUntil DateTime? @map("banned_until")
banReason   String?   @map("ban_reason")
bannedAt    DateTime? @map("banned_at")
bannedBy    String?   @map("banned_by")
```

The migration must contain only five `ADD COLUMN` clauses, with `is_banned BOOLEAN NOT NULL DEFAULT false`; it must not contain `DELETE`, `TRUNCATE`, or destructive column changes. Extend `IAuthRepository` with `findAdminAccount`, `setBan`, `clearBan`, `normalizeExpiredBan`, `listAdminSessions`, and ID-scoped revocation methods.

- [ ] **Step 4: Generate Prisma client and verify**

First inspect the target: `npm exec nx show project @org/auth -- --json`

Run the configured generate target shown by Nx (expected: `npm exec nx run @org/auth:prisma-generate`), then:

`npm exec nx test @org/auth -- --runInBand --testPathPattern=auth.prisma.repo.spec.ts && npm exec nx typecheck @org/auth`

Expected: PASS; generated types include all five fields.

- [ ] **Step 5: Commit**

```bash
git add libs/backend/auth/src/database libs/backend/auth/src/interfaces
git commit -m "feat(auth): persist account bans"
```

### Task 3: Implement Redis ban markers and atomic Auth behavior

**Files:**
- Create: `libs/backend/auth/src/cache/ban.cache.interface.ts`
- Create: `libs/backend/auth/src/cache/ban.redis.repo.ts`
- Modify: `libs/backend/auth/src/lib/auth.module.ts`
- Modify: `libs/backend/auth/src/cache/session.redis.repo.ts`
- Test: `libs/backend/auth/src/cache/ban.redis.repo.spec.ts`
- Test: `libs/backend/auth/src/cache/session.redis.repo.spec.ts`

- [ ] **Step 1: Write failing cache tests**

Cover `ban:<credentialsId>` JSON values, temporary `SET ... PX ttl`, permanent marker without expiry, clear, and bulk session deletion including the `user_sessions:<id>` set.

```ts
await repo.set('target', { reason: 'Spam', bannedUntil: until.toISOString() });
expect(redis.set).toHaveBeenCalledWith('ban:target', expect.any(String), 'PX', 3_600_000);
```

- [ ] **Step 2: Verify failure**

Run: `npm exec nx test @org/auth -- --runInBand --testPathPattern='(ban|session).redis.repo.spec.ts'`

Expected: FAIL because the ban repository and bulk session cleanup do not exist.

- [ ] **Step 3: Implement cache operations**

Expose `IBanCacheRepository.get/set/clear`; compute TTL from the supplied absolute `bannedUntil`, reject non-positive TTL, and use no expiry for permanent bans. Implement `removeAllForUser` with a Redis transaction that deletes each `session:<id>` key and `user_sessions:<id>`.

- [ ] **Step 4: Run focused verification**

Run: `npm exec nx test @org/auth -- --runInBand --testPathPattern='(ban|session).redis.repo.spec.ts' && npm exec nx typecheck @org/auth`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/backend/auth/src/cache libs/backend/auth/src/lib/auth.module.ts
git commit -m "feat(auth): store immediate ban markers"
```

### Task 4: Implement hierarchy, duration, ban, unban, and normalization

**Files:**
- Create: `libs/backend/auth/src/admin/admin-policy.ts`
- Create: `libs/backend/auth/src/admin/admin-ban.service.ts`
- Create: `libs/backend/auth/src/admin/admin-ban.service.spec.ts`
- Modify: `libs/backend/auth/src/services/auth.service.ts`
- Modify: `libs/backend/auth/src/interfaces/auth.interface.ts`
- Modify: `libs/backend/auth/src/lib/auth.module.ts`

- [ ] **Step 1: Write policy and service tests**

Cover: CREATOR manages ADMIN/MODERATOR/USER but not self; ADMIN manages MODERATOR/USER only; other actors are denied; all five duration calculations use an injected clock; preset labels are stored; custom reasons are trimmed; ban/unban are idempotent; expired fields normalize on login and refresh; Redis failure yields `ServiceUnavailableException` and never returns success.

```ts
expect(canManage('ADMIN', 'MODERATOR', false)).toBe(true);
expect(canManage('ADMIN', 'ADMIN', false)).toBe(false);
expect(canManage('CREATOR', 'USER', true)).toBe(false);
```

- [ ] **Step 2: Verify failure**

Run: `npm exec nx test @org/auth -- --runInBand --testPathPattern=admin-ban.service.spec.ts`

Expected: FAIL because the policy and service do not exist.

- [ ] **Step 3: Implement minimal domain logic**

Use a fixed duration map in milliseconds and inject `now: () => Date` for deterministic tests. Ban order is: validate actor/target and request; persist Auth ban fields and SQL session revocation in one Prisma transaction; remove Redis sessions; write marker. If Redis setup fails, clear the DB ban fields and marker best-effort, then throw `503`; this explicit compensation is required because PostgreSQL and Redis cannot share a transaction. Unban clears DB fields and marker and is safe when already unbanned.

At the beginning of credential validation, login, OAuth login, and refresh, normalize an expired temporary ban. Reject active bans with a structured exception payload `{ code: 'ACCOUNT_BANNED', reason, bannedUntil }`.

- [ ] **Step 4: Verify the Auth library**

Run: `npm exec nx test @org/auth -- --runInBand && npm exec nx lint @org/auth && npm exec nx typecheck @org/auth`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/backend/auth/src/admin libs/backend/auth/src/services libs/backend/auth/src/interfaces libs/backend/auth/src/lib
git commit -m "feat(auth): enforce administrative bans"
```

### Task 5: Add Auth administrative RPCs

**Files:**
- Modify: `libs/backend/core/src/constants/queues/auth.queue.ts`
- Modify: `libs/backend/auth/src/controllers/auth.controller.ts`
- Test: `libs/backend/auth/src/controllers/auth.controller.spec.ts`

- [ ] **Step 1: Write controller contract tests**

Assert delegation for `GET_ADMIN_ACCOUNT`, `LIST_ADMIN_SESSIONS`, `REVOKE_ADMIN_SESSION`, `REVOKE_ALL_ADMIN_SESSIONS`, `BAN_ACCOUNT`, and `UNBAN_ACCOUNT`, including `actorId` on mutating calls.

- [ ] **Step 2: Verify failure**

Run: `npm exec nx test @org/auth -- --runInBand --testPathPattern=auth.controller.spec.ts`

Expected: FAIL because patterns/handlers are absent.

- [ ] **Step 3: Add constants and handlers**

```ts
BAN_ACCOUNT: { cmd: 'auth.admin.ban-account' },
UNBAN_ACCOUNT: { cmd: 'auth.admin.unban-account' },
GET_ADMIN_ACCOUNT: { cmd: 'auth.admin.get-account' },
LIST_ADMIN_SESSIONS: { cmd: 'auth.admin.list-sessions' },
REVOKE_ADMIN_SESSION: { cmd: 'auth.admin.revoke-session' },
REVOKE_ALL_ADMIN_SESSIONS: { cmd: 'auth.admin.revoke-all-sessions' },
```

Handlers must return shared contract types and forward the actor identity rather than trusting a role supplied by the browser.

- [ ] **Step 4: Verify**

Run: `npm exec nx test @org/auth -- --runInBand --testPathPattern=auth.controller.spec.ts && npm exec nx typecheck @org/core && npm exec nx typecheck @org/auth`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/backend/core/src/constants/queues/auth.queue.ts libs/backend/auth/src/controllers
git commit -m "feat(auth): expose admin RPC operations"
```

### Task 6: Enforce ban markers in Gateway HTTP and WebSocket authentication

**Files:**
- Create: `libs/backend/core/src/ban/ban-marker.repository.ts`
- Create: `libs/backend/core/src/guards/active-account.guard.ts`
- Create: `libs/backend/core/src/guards/active-account.guard.spec.ts`
- Modify: `libs/backend/core/src/index.ts`
- Modify: `apps/backend/gateway/src/app/gateway.module.ts`
- Modify: all protected Gateway controllers in `apps/backend/gateway/src/controllers/*.controller.ts`
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- Test: `apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts`

- [ ] **Step 1: Write failing guard/socket tests**

Assert no marker passes, a marker throws structured `403`, malformed Redis values fail closed as `503`, socket handshake checks the same marker after JWT verification, and `disconnectUser(id)` disconnects every registered socket and removes the map entry.

- [ ] **Step 2: Verify failure**

Run: `npm exec nx test @org/core -- --runInBand --testPathPattern=active-account.guard.spec.ts && npm exec nx test @org/gateway -- --runInBand --testPathPattern=chat.socket-gateway.spec.ts`

Expected: FAIL because enforcement does not exist.

- [ ] **Step 3: Implement enforcement**

`ActiveAccountGuard` reads `request.user.sub`, queries `ban:<id>`, and throws:

```ts
throw new ForbiddenException({ code: 'ACCOUNT_BANNED', reason: marker.reason, bannedUntil: marker.bannedUntil });
```

Apply guards in order `@UseGuards(JwtGuard, ActiveAccountGuard)` to every protected HTTP controller. In Socket.IO, verify JWT first, then await the repository lookup before registering the socket. Keep `disconnectUser(userId): void` public for the Admin controller.

- [ ] **Step 4: Verify**

Run: `npm exec nx test @org/core -- --runInBand && npm exec nx test @org/gateway -- --runInBand && npm exec nx typecheck @org/gateway`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/backend/core/src apps/backend/gateway/src
git commit -m "feat(gateway): enforce bans immediately"
```

### Task 7: Add protected Admin Gateway endpoints and aggregation

**Files:**
- Create: `apps/backend/gateway/src/controllers/admin.controller.ts`
- Create: `apps/backend/gateway/src/controllers/admin.controller.spec.ts`
- Modify: `apps/backend/gateway/src/app/gateway.module.ts`
- Modify: `libs/backend/core/src/constants/queues/media.queue.ts`
- Modify: `libs/backend/media/src/controllers/media.controller.ts`

- [ ] **Step 1: Write Gateway E2E-style controller tests**

Using the existing TestingModule/Supertest pattern, cover 401 unauthenticated, 403 USER/MODERATOR, successful CREATOR/ADMIN access, ADMIN-to-ADMIN and self-management denial from Auth RPC, 404 target, search passthrough, detail aggregation, session deletion, idempotent ban/unban, and socket disconnect after successful ban only.

```ts
await request(app.getHttpServer()).post('/admin/users/target/ban').send({ duration: 'ONE_DAY', reason: 'SPAM' }).expect(201);
expect(chatGateway.disconnectUser).toHaveBeenCalledWith('target');
```

- [ ] **Step 2: Verify failure**

Run: `npm exec nx test @org/gateway -- --runInBand --testPathPattern=admin.controller.spec.ts`

Expected: FAIL because `AdminController` is absent.

- [ ] **Step 3: Implement routes and aggregation**

Use `@Controller('admin')`, `@UseGuards(JwtGuard, ActiveAccountGuard, RolesGuard)`, and `@Roles('CREATOR', 'ADMIN')`. Search delegates to Search Service. Detail fetches User profile and Auth detail in parallel, then Media avatar history and session summary, preserving service ownership. All mutations pass `actorId: jwt.sub`; do not implement hierarchy in the Gateway. Add a Media RPC for avatar history if the existing history pattern cannot safely query another uploader.

- [ ] **Step 4: Verify**

Run: `npm exec nx test @org/gateway -- --runInBand --testPathPattern=admin.controller.spec.ts && npm exec nx lint @org/gateway && npm exec nx typecheck @org/gateway`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/gateway/src libs/backend/core/src/constants/queues/media.queue.ts libs/backend/media/src/controllers/media.controller.ts
git commit -m "feat(gateway): expose admin user API"
```

### Task 8: Scaffold the separate Admin SPA

**Files:**
- Create via Nx generator: `apps/client/admin/*`
- Modify: `apps/client/admin/vite.config.mts`
- Modify: `apps/client/admin/src/styles.css`
- Modify: workspace TypeScript/Nx references generated by Nx

- [ ] **Step 1: Invoke the required `nx-generate` skill**

At execution time, invoke `nx-generate` before exploring generator options. If unavailable, stop and report the missing required capability rather than guessing generator flags.

- [ ] **Step 2: Inspect generator options**

Run: `npm exec nx g @nx/react:app --help`

Expected: help lists the installed React application generator options.

- [ ] **Step 3: Generate `apps/client/admin`**

Use the option names confirmed by help to generate a Vite + React Router + Vitest application named `admin` under `apps/client`, without adding another package manager lockfile.

- [ ] **Step 4: Apply workspace-specific Vite settings**

Configure `envDir: '../../..'`, a non-conflicting development port, `host: true`, and `/api` plus `/socket.io` proxies to `http://localhost:3000`. Set Vite `base: '/admin/'`. Import `@org/shared` global styles and ensure Tailwind's existing `@source "../../../../../apps/client/**/*.{ts,tsx}"` continues to cover this app.

- [ ] **Step 5: Verify the generated app**

First run `npm exec nx show project @org/admin -- --json`, then run the targets it reports:

`npm exec nx test @org/admin -- --run && npm exec nx lint @org/admin && npm exec nx typecheck @org/admin && npm exec nx build @org/admin`

Expected: PASS; build assets use `/admin/` URLs.

- [ ] **Step 6: Commit**

```bash
git add apps/client/admin tsconfig.base.json
git commit -m "feat(admin): scaffold standalone SPA"
```

### Task 9: Build Admin entity queries and route guards

**Files:**
- Create: `libs/client/entities/admin/package.json`
- Create: `libs/client/entities/admin/src/api/admin.api.ts`
- Create: `libs/client/entities/admin/src/api/admin.queries.ts`
- Create: `libs/client/entities/admin/src/index.ts`
- Create: `apps/client/admin/src/app/router/guards.tsx`
- Create: `apps/client/admin/src/app/router/router.tsx`
- Test: `apps/client/admin/src/app/router/guards.spec.tsx`
- Test: `libs/client/entities/admin/src/api/admin.queries.spec.tsx`

- [ ] **Step 1: Write failing tests**

Test unauthenticated redirect to `/auth/login` with a return location, USER/MODERATOR redirect to `/admin/404`, CREATOR/ADMIN access, unknown route redirect to `/admin/404`, API paths, and stable query keys.

- [ ] **Step 2: Verify failure**

Run: `npm exec nx test @org/admin -- --run`

Expected: FAIL because router guards do not exist.

- [ ] **Step 3: Implement API and guards**

Use `authedFetch` and `API_ROUTES.admin`. Query keys must be factories:

```ts
export const adminKeys = {
  all: ['admin'] as const,
  users: (query: string) => [...adminKeys.all, 'users', query] as const,
  user: (id: string) => [...adminKeys.all, 'user', id] as const,
  sessions: (id: string) => [...adminKeys.user(id), 'sessions'] as const,
};
```

Reuse the existing session store/bootstrap. Because the Admin SPA is separate, unauthenticated navigation uses `window.location.assign('/auth/login?from=/admin')`; invalid authenticated roles stay within the app at `/admin/404`.

- [ ] **Step 4: Verify**

Run: `npm exec nx test @org/admin -- --run && npm exec nx test @org/entities-admin -- --run && npm exec nx typecheck @org/admin && npm exec nx typecheck @org/entities-admin`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/admin/src libs/client/entities/admin
git commit -m "feat(admin): add API queries and access guards"
```

### Task 10: Build the Admin pages and session actions

**Files:**
- Create: `libs/client/pages/admin/pages-overview/*`
- Create: `libs/client/pages/admin/pages-users/*`
- Create: `libs/client/pages/admin/pages-user-detail/*`
- Create: `libs/client/pages/admin/pages-not-found/*`
- Modify: `apps/client/admin/src/app/router/router.tsx`
- Test: page specs beside each page

- [ ] **Step 1: Write failing page tests**

Test direct search navigation, debounced query submission, loading/empty/error/result states, row navigation, detail sections (profile, role, OAuth, avatar history, session summary, ban), revoke-one/all confirmations, and messenger return link.

- [ ] **Step 2: Verify failure**

Run: `npm exec nx run-many -t test -p @org/pages-admin-overview @org/pages-admin-users @org/pages-admin-user-detail @org/pages-admin-not-found -- --run`

Expected: FAIL until the page packages exist.

- [ ] **Step 3: Implement focused FSD slices**

Pages may import `@org/entities-admin` and `@org/shared`, but not Gateway/client app internals. Keep search state in URL `?query=` so reload/back navigation is stable. User detail session mutations invalidate `adminKeys.sessions(id)` and `adminKeys.user(id)`.

- [ ] **Step 4: Verify pages and boundaries**

Run: `npm exec nx run-many -t test lint typecheck -p @org/pages-admin-overview @org/pages-admin-users @org/pages-admin-user-detail @org/pages-admin-not-found`

Expected: PASS with no module-boundary violations.

- [ ] **Step 5: Commit**

```bash
git add libs/client/pages/admin apps/client/admin/src/app/router
git commit -m "feat(admin): add user administration pages"
```

### Task 11: Build the ban dialog and query invalidation

**Files:**
- Create: `libs/client/features/admin-ban/package.json`
- Create: `libs/client/features/admin-ban/src/model/use-admin-ban.ts`
- Create: `libs/client/features/admin-ban/src/ui/admin-ban-dialog.tsx`
- Create: `libs/client/features/admin-ban/src/index.ts`
- Test: `libs/client/features/admin-ban/src/ui/admin-ban-dialog.spec.tsx`
- Modify: `libs/client/pages/admin/pages-user-detail/src/lib/user-detail-page.tsx`

- [ ] **Step 1: Write failing behavior tests**

Cover duration/reason presets, CUSTOM field visibility, 5/500-character errors, trimmed submission, server error display, disabled pending state, unban, and invalidation of list/detail/session keys after success.

```ts
expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminKeys.all });
```

- [ ] **Step 2: Verify failure**

Run: `npm exec nx test @org/features-admin-ban -- --run`

Expected: FAIL because the feature does not exist.

- [ ] **Step 3: Implement the dialog and mutations**

Use `adminBanRequestSchema` through the repository's existing form approach. Render custom text only for `CUSTOM`; send no `customReason` for presets. On success invalidate `adminKeys.all` so all affected list/detail views refresh, close the dialog, and show a toast.

- [ ] **Step 4: Verify**

Run: `npm exec nx test @org/features-admin-ban -- --run && npm exec nx lint @org/features-admin-ban && npm exec nx typecheck @org/features-admin-ban && npm exec nx test @org/pages-admin-user-detail -- --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/client/features/admin-ban libs/client/pages/admin/pages-user-detail
git commit -m "feat(admin): add ban and unban controls"
```

### Task 12: Add the messenger Admin link and production routing

**Files:**
- Modify: `libs/client/pages/messenger/pages-settings/src/lib/settings-page.tsx`
- Test: `libs/client/pages/messenger/pages-settings/src/lib/settings-page.spec.tsx`
- Modify: `docker/demo/nginx/conf/default.conf`
- Modify: `docker/demo/nginx/Dockerfile`
- Modify: `docker/demo/nginx/html/` population step used by deployment

- [ ] **Step 1: Write the failing link visibility test**

Test that CREATOR and ADMIN see a shield link with `href="/admin"`, while MODERATOR and USER do not. Assert a real anchor/full navigation, not React Router navigation.

- [ ] **Step 2: Verify failure**

Run: `npm exec nx test @org/pages-settings -- --run`

Expected: FAIL because the Admin link is absent.

- [ ] **Step 3: Implement the role-gated link**

Read role from the existing authenticated user/session state and render `<a href="/admin">`. Do not expose management actions in the messenger.

- [ ] **Step 4: Configure production `/admin` serving**

Update `docker/demo/nginx/conf/default.conf` with an exact `/admin` redirect, an Admin SPA fallback, and the existing messenger fallback. Update `docker/demo/nginx/Dockerfile` and the deployment population step so messenger output remains at `html/` while Admin output is copied to `html/admin/`.

Expected routing semantics:

```nginx
location = /admin { return 301 /admin/; }
location /admin/ { try_files $uri $uri/ /admin/index.html; }
location / { try_files $uri $uri/ /index.html; }
```

- [ ] **Step 5: Verify builds and link tests**

Run: `npm exec nx test @org/pages-settings -- --run && npm exec nx build @org/messenger && npm exec nx build @org/admin`

Expected: PASS; both dist outputs exist and Admin deep links resolve in the built container.

- [ ] **Step 6: Commit**

```bash
git add libs/client/pages/messenger/pages-settings docker/demo/nginx
git commit -m "feat(admin): expose and serve admin SPA"
```

### Task 13: Add integration, migration, and runtime acceptance coverage

**Files:**
- Create: `libs/backend/auth/src/admin/admin-ban.integration.spec.ts`
- Create: `apps/backend/gateway/src/admin-ban.e2e-spec.ts`
- Create: `apps/backend/gateway/src/admin-ban.runtime.spec.ts`
- Create: `scripts/verify-auth-ban-migration.sh`
- Modify: affected project target configuration to expose integration targets

- [ ] **Step 1: Write integration tests**

Against disposable PostgreSQL/Redis test dependencies, cover additive migration over representative credentials/sessions, temporary marker TTL bounds, permanent marker `TTL = -1`, DB and Redis session revocation, unban cleanup, compensation on Redis failure, next HTTP request structured `403`, and online socket disconnection.

- [ ] **Step 2: Verify tests fail before harness completion**

Run the new Nx integration targets discovered via `npm exec nx show project @org/auth -- --json` and `npm exec nx show project @org/gateway -- --json`.

Expected: FAIL until dependency setup and fixtures are wired.

- [ ] **Step 3: Implement deterministic fixtures and migration verification**

The migration script must insert representative Credentials/OAuthAccount/Session rows, record row counts and IDs, apply the migration through the Auth Nx migration target, assert identical IDs/counts afterward, and assert default `is_banned = false` with nullable metadata. It must use `set -euo pipefail` and an isolated test database URL; never run against the development database.

- [ ] **Step 4: Run full affected verification**

Run: `npm exec nx affected -t test lint typecheck build`

Then run the Auth integration, Gateway E2E/runtime, and migration verification targets.

Expected: every target PASS; runtime test observes `{ code: 'ACCOUNT_BANNED', reason, bannedUntil }` and a disconnected socket.

- [ ] **Step 5: Review against the approved design**

Confirm every Admin endpoint exists, both allowed roles can enter, hierarchy/self-denial is server-enforced, immediate HTTP/WS enforcement works, no standalone backend/database exists, and no deferred maintenance/reset/broadcast feature was introduced.

- [ ] **Step 6: Commit**

```bash
git add libs/backend/auth/src/admin apps/backend/gateway/src scripts project.json apps/backend/gateway/project.json
git commit -m "test(admin): verify end-to-end ban workflow"
```
