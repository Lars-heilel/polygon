# Auth System Diagnostic Audit

## Summary

Status: in progress

## Classification Legend

- `implemented`: code and tests match the documented expectation.
- `implemented-no-test`: behavior appears implemented, but direct test coverage is missing or weak.
- `bug`: behavior contradicts the spec or likely breaks the user flow.
- `missing-from-spec`: code contains behavior that is not documented clearly enough.
- `missing-from-code`: spec requires behavior that is absent from implementation.
- `intended-behavior`: current behavior differs from a first intuition, but is justified by architecture, security, or product constraints.
- `needs-decision`: the correct behavior is ambiguous and requires user/product confirmation.
- `needs-manual-validation`: behavior depends on real email, OAuth provider callbacks, browser cookies, Docker services, or visual inspection.

## Source Documents Reviewed

| Document | Reviewed | Notes |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | yes | Cookie auth through gateway, database-per-service, RabbitMQ events, FSD package boundaries. |
| `docs/DEVELOPMENT.md` | yes | Nx targets, strict TypeScript, Nest repository pattern, package boundary rules. |
| `docs/MONOREPO_GOTCHAS.md` | yes | Vite proxy, Tailwind source scanning, MSW layout, gateway Supertest strategy. |
| `docs/specs/auth-service.md` | yes | Auth acceptance criteria and known gaps for bans, instant revoke, email templates. |
| `docs/specs/gateway-service.md` | yes | Gateway auth/cookie/WebSocket behavior and known gaps for exception filter, instant revoke, roles. |
| `docs/specs/client-messenger.md` | yes | Client auth/session bootstrap and frontend UX expectations. |
| `docs/OBSERVABILITY.md` | yes | Metrics, logs, traces, frontend error intake, redaction and retention expectations. |

## Nx Project Targets Reviewed

| Project | Targets checked | Notes |
| --- | --- | --- |
| `@org/auth` | `typecheck`, `lint`, `test`, `prisma-generate` | `test`: yes; `lint`: yes; `typecheck`: yes; `build`: no. |
| `@org/auth-service` | `typecheck`, `lint`, `test`, `build`, `serve`, `preview`, `serve-static`, `build-deps`, `watch-deps`, `prune-lockfile`, `copy-workspace-modules`, `prune` | `test`: yes; `lint`: yes; `typecheck`: yes; `build`: yes. |
| `@org/gateway` | `typecheck`, `lint`, `test`, `build`, `serve`, `preview`, `serve-static`, `build-deps`, `watch-deps`, `prune-lockfile`, `copy-workspace-modules`, `prune` | `test`: yes; `lint`: yes; `typecheck`: yes; `build`: yes. |
| `@org/messenger` | `typecheck`, `build`, `serve`, `dev`, `preview`, `serve-static`, `build-deps`, `watch-deps`, `lint`, `test` | `test`: yes; `lint`: yes; `typecheck`: yes; `build`: yes. |
| `@org/features-auth` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | `test`: no; `lint`: yes; `typecheck`: yes; `build`: yes. |
| `@org/entities-user` | `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish` | `test`: no; `lint`: yes; `typecheck`: yes; `build`: yes. |
| `@org/shared` | `typecheck`, `build`, `build-deps`, `watch-deps`, `serve`, `dev`, `preview`, `serve-static`, `test`, `lint`, `build-storybook`, `storybook`, `static-storybook`, `nx-release-publish` | `test`: yes; `lint`: yes; `typecheck`: yes; `build`: yes. |
| `@org/core` | `typecheck`, `lint`, `test` | `test`: yes; `lint`: yes; `typecheck`: yes; `build`: no. |

## Spec-To-Code Matrix

| Area | Expected Behavior | Implementation Evidence | Existing Tests | Status | Follow-up |
| --- | --- | --- | --- | --- | --- |
| Backend auth: repository boundary | Auth owns its database and services access persistence through the repository pattern. | `PrismaService` uses `AUTH_DATABASE_URL` at `libs/backend/auth/src/database/prisma/prisma.service.ts:14-18`; `OrgAuthModule` binds `AUTH_PRISMA_REPOSITORY_TOKEN` to `AuthPrismaRepository` at `libs/backend/auth/src/lib/auth.module.ts:68-70`; auth services inject that token rather than Prisma directly. | `libs/backend/auth/src/database/repository/auth.prisma.repo.spec.ts` | implemented | No action. |
| Backend auth: registration | Registration creates credentials, emits profile/search events, and sends verification email. | `AuthService.register` hashes and persists credentials, sends `USER_PATTERNS.CREATE`, emits `USER_EVENTS.REGISTERED`, then invokes `verification.generateAndSend` at `libs/backend/auth/src/services/auth.service.ts:65`. | none | implemented-no-test | Add direct registration tests for credential creation, User/Search calls, and verification-email failure handling. |
| Backend auth: login | Login validates credentials, email verification, rate limiting, and ban state. | `validateCredentials` checks persisted credentials, `AdminBanService.assertAccountActive`, password hash, and `isVerified` at `libs/backend/auth/src/services/auth.service.ts:117`; it rejects only when attempts are greater than `5` at line 126. | `libs/backend/auth/src/services/auth.service.spec.ts` | bug | Change the threshold to reject the fifth failed attempt, matching `docs/specs/auth-service.md:222-225`, and add boundary tests for attempts 4, 5, and 6. |
| Backend auth: refresh | Refresh rotates token pair and detects replay or revoked sessions. | `AuthService.refresh` verifies the JWT, replaces the SQL token hash, and rejects `revokedAt`; replay calls `repo.revokeAllSessions` but does not remove Redis session keys at `libs/backend/auth/src/services/auth.service.ts:372-435`. | `libs/backend/auth/src/services/auth.service.spec.ts` | bug | Reconcile Redis session keys during replay revocation and add a test that every active session becomes absent from Redis. |
| Backend auth: logout | Logout revokes SQL session and Redis active session. | `AuthService.logout` hashes the refresh token, invokes `repo.revokeSession`, then removes both `session:<id>` and the user-session index at `libs/backend/auth/src/services/auth.service.ts:344-369`. | `libs/backend/auth/src/services/auth.service.spec.ts` | implemented | No action. |
| Backend auth: user sessions | Session listing, one-session revoke, and revoke-all match the spec. | Listing maps active SQL sessions and current-session state; one-session revoke clears SQL and Redis. `revokeAllSessions(credentialsId)` has no current session parameter and revokes every session at `libs/backend/auth/src/services/auth.service.ts:438-492`, contrary to `docs/specs/auth-service.md:190-192`. | `libs/backend/auth/src/services/auth.service.spec.ts` | bug | Preserve the current session for the user-facing "all other sessions" command, or update the documented command semantics and its tests. |
| Backend auth: password recovery | Forgot/reset password hides account enumeration and revokes sessions when required. | Unknown or passwordless accounts return normally from `forgotPassword`; reset hashes the new password and calls `revokeAllSessions` at `libs/backend/auth/src/services/auth.service.ts:245-278`. That method removes every cached session and revokes all SQL rows at `auth.service.ts:481-491`, but `docs/specs/auth-service.md:206` requires retaining the current authenticated session when applicable. It also does not clear login attempts required by `docs/specs/auth-service.md:227`. | none | bug | Preserve the current authenticated session during reset when applicable, clear login attempts, and add coverage for enumeration, current-session retention, and revoked other sessions. |
| Backend auth: OAuth | OAuth creates or links accounts for GitHub, Google, and Yandex. | All three strategies submit provider identity to `OAUTH_LOGIN`; `AuthService.oauthLogin` finds or creates credentials and creates an OAuth binding at `libs/backend/auth/src/services/auth.service.ts:280-342`. The unconditional User-service create request for an email-linked credential needs integration confirmation. | `libs/backend/auth/src/services/auth.service.spec.ts` | needs-manual-validation | Add provider-specific unit/integration coverage for new, linked-by-email, and existing-binding paths; validate real provider callbacks and User-service idempotency. |
| Backend auth: bans | Login ban and admin ban semantics are documented and tested. | Login calls `assertAccountActive`; `AdminBanService` persists ban state, revokes SQL/Redis sessions, and normalizes expired bans at `libs/backend/auth/src/admin/admin-ban.service.ts:113-217`. The implementation and tests establish administrator-ban behavior, while `docs/specs/auth-service.md:250` still marks account blocking as pending. | `libs/backend/auth/src/services/auth.service.spec.ts`; `libs/backend/auth/src/admin/admin-ban.service.spec.ts`; `libs/backend/auth/src/cache/ban.redis.repo.spec.ts` | missing-from-spec | Document the implemented administrator-ban lifecycle, authorization, session revocation, expiry normalization, and user-facing error contract. |
| Backend auth: DTO validation | Zod DTOs are based on shared contracts and validation behavior is safe. | DTO classes derive from `@org/common` schemas in `libs/backend/auth/src/dto/*.ts`, but `AuthController` applies `ZodValidationPipe` only to registration at `libs/backend/auth/src/controllers/auth.controller.ts:29-31`; other RMQ handlers accept unvalidated structural payloads. | none | bug | Apply shared Zod DTO validation to every externally reachable auth message pattern and add invalid-payload controller tests. |
| Backend auth: logging | Logs do not expose raw password, token, reset token, OAuth code, or unsafe payloads in demo/prod. | For every non-`production` environment, `PrismaService` enables query events at `libs/backend/auth/src/database/prisma/prisma.service.ts:15-27`; slow queries log raw serialized `params` at lines 41-45. Those values can contain emails and credential/session hashes, and Pino path redaction cannot inspect values serialized inside `params`. | `libs/backend/core/src/observability/logger.spec.ts` | bug | Omit or redact query parameters outside explicitly safe local development and add coverage that slow-query output cannot expose credential or session values. |

## Backend Auth Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |
| Repository boundary follows database-per-service ownership | `PrismaService` uses `AUTH_DATABASE_URL`; `OrgAuthModule` binds the auth repository token to `AuthPrismaRepository`; services inject the token rather than Prisma. | implemented | No action. |
| Registration side effects lack direct coverage | `AuthService.register` performs persistence, User/Search calls, and verification dispatch (`libs/backend/auth/src/services/auth.service.ts:65-104`); no direct test exists. | implemented-no-test | Add a focused `AuthService.register` suite. |
| Rate limiter blocks attempt six, not attempt five | `attempts > LOGIN_ATTEMPTS_LIMIT` at `auth.service.ts:126` conflicts with the fifth-attempt expectation in `docs/specs/auth-service.md:222-225`. | bug | Correct the boundary and test it. |
| Replay revocation leaves Redis active-session state untouched | Revoked refresh handling calls only `repo.revokeAllSessions` at `auth.service.ts:394-400`; `SessionGuard` accepts an existing Redis session key. | bug | Remove all affected Redis session keys during replay handling. |
| Logout has SQL and Redis cleanup coverage | `logout` revokes the hashed SQL session and removes both Redis keys; the behavior is asserted in `auth.service.spec.ts`. | implemented | No action. |
| User revoke-all also revokes the current session | The API accepts only `credentialsId` and removes every Redis entry plus all active SQL rows (`auth.service.ts:481-492`). | bug | Preserve current session or change the documented command meaning. |
| Password reset removes the current session and leaves the login-attempt key | `resetPassword` delegates to `revokeAllSessions`, which removes every Redis session and revokes all SQL rows; it never calls `clearLoginAttempts`. The spec retains the current authenticated session when applicable and clears the block after recovery. | bug | Preserve the current session, clear the attempt key, and cover both requirements. |
| OAuth linking needs cross-service confirmation | The linked-by-email path calls User `CREATE` before creating the provider binding (`auth.service.ts:298-326`); no GitHub/Yandex or link-success test is present. | needs-manual-validation | Verify idempotency with User service and provider callbacks. |
| Administrator-ban behavior is absent from the specification | Admin-ban persistence, authorization, SQL/Redis revocation, and expiry normalization are implemented and unit-tested, but the auth spec marks account blocking as pending. | missing-from-spec | Add the implemented administrator-ban contract to the auth specification. |
| RMQ validation is partial | Shared Zod DTO definitions exist, but only the registration handler installs a runtime pipe. | bug | Validate every auth RPC payload. |
| Non-production slow-query logging exposes serialized parameters | `PrismaService` enables query events when `NODE_ENV !== 'production'` and logs `{ duration: e.duration, params: e.params }`; Pino field-path redaction does not inspect values inside the serialized `params` string. | bug | Omit or redact query parameters outside explicitly safe local development and add slow-query redaction coverage. |

## Gateway Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

## Frontend Auth And UX Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

## Visual Review

| Viewport | Route Or Component | Observation | Status | Follow-up |
| --- | --- | --- | --- | --- |

## Observability And Logging Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

## Swagger Drift

| Endpoint Or Schema | Observed Behavior | Swagger Documentation | Status | Follow-up |
| --- | --- | --- | --- | --- |

## Automated Verification Results

| Command | Result | Evidence |
| --- | --- | --- |
| `sed -n '1,260p' docs/ARCHITECTURE.md` | pass | Exited `0`; required architecture source range read. |
| `sed -n '1,280p' docs/DEVELOPMENT.md` | pass | Exited `0`; required development source range read. |
| `sed -n '1,260p' docs/MONOREPO_GOTCHAS.md` | pass | Exited `0`; required monorepo-gotchas source range read. |
| `sed -n '1,260p' docs/specs/auth-service.md` | pass | Exited `0`; required auth-service specification range read. |
| `sed -n '1,260p' docs/specs/gateway-service.md` | pass | Exited `0`; required gateway-service specification range read. |
| `sed -n '1,260p' docs/specs/client-messenger.md` | pass | Exited `0`; required client-messenger specification range read. |
| `sed -n '1,260p' docs/OBSERVABILITY.md` | pass | Exited `0`; required observability source range read. |
| `npm exec nx show project @org/auth --json` | pass | Exited `0`; targets: `typecheck`, `lint`, `test`, `prisma-generate`. |
| `npm exec nx show project @org/auth-service --json` | pass | Exited `0`; targets include `typecheck`, `lint`, `test`, `build`, `serve`, and packaging targets. |
| `npm exec nx show project @org/gateway --json` | pass | Exited `0`; targets include `typecheck`, `lint`, `test`, `build`, `serve`, and packaging targets. |
| `npm exec nx show project @org/messenger --json` | pass | Exited `0`; targets include `typecheck`, `build`, `serve`, `dev`, `lint`, and `test`. |
| `npm exec nx show project @org/features-auth --json` | pass | Exited `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/entities-user --json` | pass | Exited `0`; targets: `typecheck`, `build`, `build-deps`, `watch-deps`, `lint`, `nx-release-publish`; no direct `test`. |
| `npm exec nx show project @org/shared --json` | pass | Exited `0`; targets include `typecheck`, `build`, `test`, `lint`, Storybook, and serve targets. |
| `npm exec nx show project @org/core --json` | pass | Exited `0`; targets: `typecheck`, `lint`, `test`; no direct `build`. |
| `rg -n "register\|validateCredentials\|login\|logout\|refresh\|verifyEmail\|resend\|forgot\|reset\|session\|revoke\|ban\|OAuth\|oauth\|emit\|ZodValidation\|Logger\|password\|token\|cookie" libs/backend/auth/src` | pass | Exit `0`; captured `auth.service.ts:65:  async register(dto: RegisterDto)` and `auth.service.ts:372:  async refresh(refreshToken: string)`. |
| `sed -n '1,560p' libs/backend/auth/src/services/auth.service.ts` | pass | Exit `0`; captured `await this.repo.revokeAllSessions(stored.credentialsId);` and `await this.sessionCache.remove(payload.sessionId);`. |
| `sed -n '1,220p' libs/backend/auth/src/controllers/auth.controller.ts` | pass | Exit `0`; captured `@UsePipes(new ZodValidationPipe(RegisterDto))` and `async refresh(@Payload() payload: { refreshToken: string })`. |
| `sed -n '1,180p' libs/backend/auth/src/services/verification.service.ts` | pass | Exit `0`; captured `this.notificationClient.emit(NOTIFICATION_EVENTS.SEND_PASSWORD_RESET, { to: email, token });`. |
| `sed -n '1,260p' libs/backend/auth/src/database/repository/auth.prisma.repo.ts` | pass | Exit `0`; captured `export class AuthPrismaRepository implements IAuthRepository` and `where: { credentialsId, revokedAt: null }`. |
| `sed -n '1,220p' libs/backend/auth/src/cache/session.redis.repo.ts` | pass | Exit `0`; captured `session: (id: string) => \`session:${id}\`` and `userSessions: (userId: string) => \`user_sessions:${userId}\``. |
| `sed -n '1,220p' libs/backend/auth/src/cache/ban.redis.repo.ts` | pass | Exit `0`; captured `const key = (credentialsId: string) => \`ban:${credentialsId}\`` and `return result === 'OK' ? ownershipToken : null;`. |
| `sed -n '1,460p' libs/backend/auth/src/services/auth.service.spec.ts` | pass | Exit `0`; captured `it('throws on revoked session (replay attack)'` and `it('revokes the session and removes from Redis'`. |
| `sed -n '1,140p' libs/backend/auth/src/controllers/auth.controller.spec.ts` | pass | Exit `0`; captured `describe('AuthController administrative RPCs'` and administrative command assertions. |
| `sed -n '1,180p' libs/backend/auth/src/database/repository/auth.prisma.repo.spec.ts` | pass | Exit `0`; captured `it('atomically persists the ban and revokes every active SQL session'`. |
| `sed -n '1,180p' libs/backend/auth/src/cache/session.redis.repo.spec.ts` | pass | Exit `0`; captured `it('deletes every indexed session and the user session set in one transaction'`. |
| `sed -n '1,180p' libs/backend/auth/src/cache/ban.redis.repo.spec.ts` | pass | Exit `0`; captured `it('sets a temporary marker with a millisecond TTL ending at bannedUntil'`. |
| Remaining required backend auth reads (`cleanup.service.ts`, `auth.redis.repo.ts`, `dto/*.ts`, `strategies/*.ts`, `guards/*.ts`) | pass | Exit `0`; captured `TTL.PASSWORD_RESET: 3_600`, `class LoginDto extends createZodDto(loginSchema)`, providers `github`/`google`/`yandex`, and `sessionCache.exists(payload.sessionId)`. |
| `rg -n "AUTH_PRISMA_REPOSITORY_TOKEN\|AuthPrismaRepository\|PrismaService" libs/backend/auth/src` | pass | Exit `0`; captured `auth.module.ts:69:    { provide: AUTH_PRISMA_REPOSITORY_TOKEN, useClass: AuthPrismaRepository },`. |
| `nl -ba libs/backend/auth/src/database/prisma/prisma.service.ts | sed -n '12,50p'` | pass | Exit `0`; captured `const isDev = config.get('NODE_ENV') !== 'production';`, `{ emit: 'event', level: 'query' }`, and `this.logger.warn({ duration: e.duration, params: e.params }, ...)`. |

## Manual Validation Points

| Flow | Why Manual | Required User Help | Status |
| --- | --- | --- | --- |
| OAuth account creation and linking for GitHub, Google, and Yandex | Provider callbacks and the User-service duplicate-create behavior cannot be proven from auth-library unit tests. | Run each provider callback against configured non-production credentials and confirm new, linked-by-email, and existing-binding flows. | needs-manual-validation |
| Auth log redaction in JSON and pretty modes | Static Pino redaction configuration exists, but the emitted output from token-bearing auth handlers needs runtime confirmation. | Run the auth service with `LOG_FORMAT=json` and `LOG_FORMAT=pretty`; capture register, refresh, reset, verification, and OAuth callback logs and confirm secrets are absent. | needs-manual-validation |

## Decisions Needed

| Decision | Context | Options | Recommendation |
| --- | --- | --- | --- |

## Prioritized Follow-Up Work

| Priority | Work Item | Reason | Suggested Test Level |
| --- | --- | --- | --- |

## Recommended Test Additions

| Level | Project | Test Gap | Suggested Coverage |
| --- | --- | --- | --- |
