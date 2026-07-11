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
| Backend auth: registration | Registration creates credentials, emits profile/search events, and sends verification email. | `AuthService.register` hashes and persists credentials, sends `USER_PATTERNS.CREATE`, emits `USER_EVENTS.REGISTERED`, then invokes `verification.generateAndSend` at `libs/backend/auth/src/services/auth.service.ts:65`. | none | implemented-no-test | Add direct registration tests for credential creation, User/Search calls, and verification-email failure handling. |
| Backend auth: login | Login validates credentials, email verification, rate limiting, and ban state. | `validateCredentials` checks persisted credentials, `AdminBanService.assertAccountActive`, password hash, and `isVerified` at `libs/backend/auth/src/services/auth.service.ts:117`; it rejects only when attempts are greater than `5` at line 126. | `libs/backend/auth/src/services/auth.service.spec.ts` | bug | Change the threshold to reject the fifth failed attempt, matching `docs/specs/auth-service.md:222-225`, and add boundary tests for attempts 4, 5, and 6. |
| Backend auth: refresh | Refresh rotates token pair and detects replay or revoked sessions. | `AuthService.refresh` verifies the JWT, replaces the SQL token hash, and rejects `revokedAt`; replay calls `repo.revokeAllSessions` but does not remove Redis session keys at `libs/backend/auth/src/services/auth.service.ts:372-435`. | `libs/backend/auth/src/services/auth.service.spec.ts` | bug | Reconcile Redis session keys during replay revocation and add a test that every active session becomes absent from Redis. |
| Backend auth: logout | Logout revokes SQL session and Redis active session. | `AuthService.logout` hashes the refresh token, invokes `repo.revokeSession`, then removes both `session:<id>` and the user-session index at `libs/backend/auth/src/services/auth.service.ts:344-369`. | `libs/backend/auth/src/services/auth.service.spec.ts` | implemented | No action. |
| Backend auth: user sessions | Session listing, one-session revoke, and revoke-all match the spec. | Listing maps active SQL sessions and current-session state; one-session revoke clears SQL and Redis. `revokeAllSessions(credentialsId)` has no current session parameter and revokes every session at `libs/backend/auth/src/services/auth.service.ts:438-492`, contrary to `docs/specs/auth-service.md:190-192`. | `libs/backend/auth/src/services/auth.service.spec.ts` | bug | Preserve the current session for the user-facing "all other sessions" command, or update the documented command semantics and its tests. |
| Backend auth: password recovery | Forgot/reset password hides account enumeration and revokes sessions when required. | Unknown or passwordless accounts return normally from `forgotPassword`; reset hashes the new password and calls `revokeAllSessions` at `libs/backend/auth/src/services/auth.service.ts:245-278`. It does not clear login-attempt state required by `docs/specs/auth-service.md:227`. | none | bug | Clear login attempts after a successful reset; add tests for indistinguishable unknown-account responses, reset revocation, and attempt-counter clearing. |
| Backend auth: OAuth | OAuth creates or links accounts for GitHub, Google, and Yandex. | All three strategies submit provider identity to `OAUTH_LOGIN`; `AuthService.oauthLogin` finds or creates credentials and creates an OAuth binding at `libs/backend/auth/src/services/auth.service.ts:280-342`. The unconditional User-service create request for an email-linked credential needs integration confirmation. | `libs/backend/auth/src/services/auth.service.spec.ts` | needs-manual-validation | Add provider-specific unit/integration coverage for new, linked-by-email, and existing-binding paths; validate real provider callbacks and User-service idempotency. |
| Backend auth: bans | Login ban and admin ban semantics are documented and tested. | Login calls `assertAccountActive`; `AdminBanService` persists ban state, revokes SQL/Redis sessions, and normalizes expired bans at `libs/backend/auth/src/admin/admin-ban.service.ts:113-217`. The spec labels account blocking as not implemented while separately describing a five-attempt temporary block. | `libs/backend/auth/src/services/auth.service.spec.ts`; `libs/backend/auth/src/admin/admin-ban.service.spec.ts`; `libs/backend/auth/src/cache/ban.redis.repo.spec.ts` | needs-decision | Define whether rate limiting and administrator bans are separate product states, then align `docs/specs/auth-service.md`, error contracts, and coverage. |
| Backend auth: DTO validation | Zod DTOs are based on shared contracts and validation behavior is safe. | DTO classes derive from `@org/common` schemas in `libs/backend/auth/src/dto/*.ts`, but `AuthController` applies `ZodValidationPipe` only to registration at `libs/backend/auth/src/controllers/auth.controller.ts:29-31`; other RMQ handlers accept unvalidated structural payloads. | none | bug | Apply shared Zod DTO validation to every externally reachable auth message pattern and add invalid-payload controller tests. |
| Backend auth: logging | Logs do not expose raw password, token, reset token, OAuth code, or unsafe payloads in demo/prod. | Auth code logs token-bearing objects at `auth.controller.ts:68-128` and `auth.service.ts:224-228`; the Pino configuration removes direct and nested password/token fields at `libs/backend/core/src/observability/logger.ts:18-108`, with configuration assertions in `logger.spec.ts`. | `libs/backend/core/src/observability/logger.spec.ts` | needs-manual-validation | Capture auth-service logs under both `LOG_FORMAT=json` and `LOG_FORMAT=pretty` and verify raw values are absent for register, refresh, reset, verification, and OAuth callback flows. |

## Backend Auth Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |
| Registration side effects lack direct coverage | `AuthService.register` performs persistence, User/Search calls, and verification dispatch (`libs/backend/auth/src/services/auth.service.ts:65-104`); no direct test exists. | implemented-no-test | Add a focused `AuthService.register` suite. |
| Rate limiter blocks attempt six, not attempt five | `attempts > LOGIN_ATTEMPTS_LIMIT` at `auth.service.ts:126` conflicts with the fifth-attempt expectation in `docs/specs/auth-service.md:222-225`. | bug | Correct the boundary and test it. |
| Replay revocation leaves Redis active-session state untouched | Revoked refresh handling calls only `repo.revokeAllSessions` at `auth.service.ts:394-400`; `SessionGuard` accepts an existing Redis session key. | bug | Remove all affected Redis session keys during replay handling. |
| Logout has SQL and Redis cleanup coverage | `logout` revokes the hashed SQL session and removes both Redis keys; the behavior is asserted in `auth.service.spec.ts`. | implemented | No action. |
| User revoke-all also revokes the current session | The API accepts only `credentialsId` and removes every Redis entry plus all active SQL rows (`auth.service.ts:481-492`). | bug | Preserve current session or change the documented command meaning. |
| Password reset does not clear the login-attempt key | Reset updates the hash and revokes sessions but never calls `clearLoginAttempts`; the specification calls for clearing the block after recovery. | bug | Clear the attempt key and cover the complete recovery flow. |
| OAuth linking needs cross-service confirmation | The linked-by-email path calls User `CREATE` before creating the provider binding (`auth.service.ts:298-326`); no GitHub/Yandex or link-success test is present. | needs-manual-validation | Verify idempotency with User service and provider callbacks. |
| Two ban concepts are not reconciled in the specification | Admin bans are implemented and extensively unit-tested, while the auth spec marks blocking as pending and also defines a login-attempt lock. | needs-decision | Specify state ownership, user-visible messages, expiry, and reset behavior. |
| RMQ validation is partial | Shared Zod DTO definitions exist, but only the registration handler installs a runtime pipe. | bug | Validate every auth RPC payload. |
| Redaction configuration exists but requires runtime proof | Pino removes direct/nested sensitive keys, yet auth handlers intentionally log token-bearing objects. | needs-manual-validation | Run controlled log-capture checks in JSON and pretty modes. |

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
| `rg -n "register\|validateCredentials\|login\|logout\|refresh\|verifyEmail\|resend\|forgot\|reset\|session\|revoke\|ban\|OAuth\|oauth\|emit\|ZodValidation\|Logger\|password\|token\|cookie" libs/backend/auth/src` | pass | Exited `0`; located backend auth implementations and unit specs. |
| `sed -n '1,560p' libs/backend/auth/src/services/auth.service.ts` | pass | Exited `0`; read registration, login, recovery, OAuth, refresh, and session flows. |
| `sed -n '1,220p' libs/backend/auth/src/controllers/auth.controller.ts` | pass | Exited `0`; read auth RPC handlers and validation use. |
| `sed -n '1,180p' libs/backend/auth/src/services/verification.service.ts` | pass | Exited `0`; read verification/reset token and cooldown behavior. |
| `sed -n '1,260p' libs/backend/auth/src/database/repository/auth.prisma.repo.ts` | pass | Exited `0`; read SQL credentials/session persistence and revocation behavior. |
| `sed -n '1,220p' libs/backend/auth/src/cache/session.redis.repo.ts` | pass | Exited `0`; read active-session Redis key management. |
| `sed -n '1,220p' libs/backend/auth/src/cache/ban.redis.repo.ts` | pass | Exited `0`; read ban marker and lock behavior. |
| `sed -n '1,460p' libs/backend/auth/src/services/auth.service.spec.ts` | pass | Exited `0`; read service unit coverage for bans, session, refresh, and logout. |
| `sed -n '1,140p' libs/backend/auth/src/controllers/auth.controller.spec.ts` | pass | Exited `0`; read controller administrative RPC coverage. |
| `sed -n '1,180p' libs/backend/auth/src/database/repository/auth.prisma.repo.spec.ts` | pass | Exited `0`; read admin persistence coverage. |
| `sed -n '1,180p' libs/backend/auth/src/cache/session.redis.repo.spec.ts` | pass | Exited `0`; read Redis session bulk-removal coverage. |
| `sed -n '1,180p' libs/backend/auth/src/cache/ban.redis.repo.spec.ts` | pass | Exited `0`; read Redis ban-marker and lock coverage. |
| Remaining required backend auth reads (`cleanup.service.ts`, `auth.redis.repo.ts`, `dto/*.ts`, `strategies/*.ts`, `guards/*.ts`) | pass | Exited `0`; inspected cleanup, cache TTLs, shared-schema DTO bindings, provider strategies, and session guard. |

## Manual Validation Points

| Flow | Why Manual | Required User Help | Status |
| --- | --- | --- | --- |

## Decisions Needed

| Decision | Context | Options | Recommendation |
| --- | --- | --- | --- |

## Prioritized Follow-Up Work

| Priority | Work Item | Reason | Suggested Test Level |
| --- | --- | --- | --- |

## Recommended Test Additions

| Level | Project | Test Gap | Suggested Coverage |
| --- | --- | --- | --- |
