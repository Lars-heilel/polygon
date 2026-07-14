# Auth System Diagnostic Audit

## Summary

Status: diagnostic audit complete; active remediation is in progress.

## Current Resolution Tracker

This section is the working truth for follow-up work. Historical findings below are kept as audit evidence, but items marked `done` here should not be treated as open unless a new regression is found.

| Area | Current status | Evidence | Notes |
| --- | --- | --- | --- |
| Common frontend-error exports/typecheck blocker | done | Fixed before `01994bf`; later gateway/shared/messenger checks passed during auth remediation. | Original P0 blocker is no longer active. |
| Backend auth registration side effects | done | `8c4ba5d test(auth): cover registration side effects`; `@org/auth` suite reached 156 passing tests. | Credential creation, User/Search calls, verification dispatch, duplicate prevention, and verification-email failure handling are covered. |
| Backend auth login rate-limit boundary | done | `7919dcb fix(auth): block login on fifth failed attempt`; `@org/auth` tests passed. | Fifth failed attempt now blocks as the spec expects. |
| Backend auth user-facing revoke other sessions | done | `7488267 fix(auth): preserve current session when revoking others`; gateway HTTP tests cover cookies and RPC payloads. | `DELETE /auth/sessions` preserves the current session and returns `Other sessions revoked`. |
| Backend auth reset clears login attempts | done | `fd9a47c fix(auth): clear login attempts after password reset`; `@org/auth` tests passed. | Password recovery no longer leaves the login-attempt block active after a successful reset. |
| Backend auth RPC payload validation | done | `a56015e fix(auth): validate auth rpc payloads`; `be79bd7 fix(auth): validate auth rpc identity payloads`; `@org/auth` tests passed. | Public auth, identity, refresh, session, and OAuth message payloads are parsed through Zod before service code. |
| Backend auth admin ban specification | done | `docs/specs/auth-service.md` documents administrator ban flow, role hierarchy, SQL/Redis session revocation, Redis ban markers, expiry normalization, error contract, and implementation status. | Login rate-limit ban and administrator ban are documented as separate mechanisms. |
| Gateway auth query/param validation | done | `d554445 fix(gateway): validate auth query and session params`; gateway HTTP tests cover invalid verify-email tokens and invalid session IDs. | Raw `verifyEmail` query and `sessions/:id` param handling is closed. |
| Gateway auth cookies and session HTTP behavior | done | Gateway HTTP tests cover login cookies, refresh missing/success, logout, current-session revoke, other-session revoke, and revoke-other-sessions. | Cookie behavior is no longer just static-review coverage. |
| Gateway auth RPC error envelope | done | `GatewayHttpExceptionFilter` normalizes HTTP/RPC errors to `{ statusCode, error, message, path, timestamp }`; gateway HTTP tests prove unsafe 5xx downstream messages do not expose email/token data; `auth.swagger.spec.ts` documents representative auth error envelopes. | Shared runtime and OpenAPI contracts are aligned for auth. |
| Gateway Zod validation logging | done | `ZodValidationExceptionFilter` is globally registered in `main.ts`; gateway HTTP tests assert sanitized `issues` are logged. | Logs include field path/code/message metadata, not raw request payloads. |
| Gateway frontend error intake logging | done | `frontend-error.controller.spec.ts` asserts only safe metadata lengths/flags are logged, not message/stack/userAgent free text. | Original free-text logging finding is stale. |
| Gateway/auth raw email log interpolation | done | Gateway/auth logs use boolean/safe summaries such as `hasEmail`; tests check sensitive downstream messages do not leak. | Keep future logs structured and avoid raw email strings. |
| Auth Prisma slow-query params | done | Current `PrismaService` logs `{ duration }` plus query text only; serialized `params` are not logged. | Original slow-query `params` finding is stale. |
| Frontend `apiFetch` console logging | done | Current `libs/client/shared/src/lib/api/client.ts` has no `console.*` calls; API client specs cover requests without console diagnostics. | Original unconditional console logging finding is stale. |
| Frontend check-email email leak | done | `bd92891 fix(auth-ui): keep verification email out of url`; messenger e2e passed. | Registration uses route state; direct `/auth/check-email` no longer displays/resends raw email from query. |
| Frontend email verification continuation UX | done | `a2acbd7 fix(auth-ui): align email verification continuation`. | Verified user flow no longer tells the user to sign in again after cookies are set. |
| Yandex OAuth removal | done | `bca305e refactor(auth): remove yandex oauth provider`; gateway HTTP test asserts `/auth/yandex` is not exposed. | User confirmed Yandex should be removed; related manual-decision rows are stale. |
| Swagger auth message/verification/session docs | done | `01994bf docs(gateway): document auth swagger contracts`; `auth.swagger.spec.ts` now covers message responses, verification redirect headers, session responses, auth cookie schemes, token-cookie response headers, refresh-token security, and representative normalized error envelopes. | Auth OpenAPI drift for the audited endpoints is closed. |
| Backend refresh replay Redis cleanup | done | `AuthService.refresh()` calls `clearCachedSessions(stored.credentialsId)` on revoked-token replay; `auth.service.spec.ts` asserts all cached session keys and user-session index entries are removed. | Historical replay-cleanup finding is stale. |
| OAuth provider linking/service idempotency | done | `@org/auth` OAuth service tests cover existing provider binding reuse, new federated credentials/profile/search side effects, linked-by-email idempotent profile upsert, and auto-verification after provider linking. | External GitHub/Google callbacks were confirmed manually by user; Yandex is removed and should not be included in future checks. |
| Frontend auth component/unit tests | done | `@org/features-auth` now has a Vitest target and 14 component tests for login, register, forgot-password, reset-password, check-email, and email-verified screens. | Remaining frontend auth work is visual/e2e coverage, not missing unit/component test infrastructure. |
| Frontend visual regression for auth pages | done | `apps/client/messenger/e2e/auth-pages.spec.ts` now checks auth routes in desktop/mobile projects for horizontal overflow, interactive-element viewport overflow, and Playwright screenshot baselines. | Covers login, register, forgot-password, reset-password with/without token, check-email, and email-verified. |
| Frontend auth refresh retry/session fallback | done | `@org/shared` `authedFetch` tests cover a `401` response triggering `/auth/refresh`, retrying the original request, sharing one refresh request across parallel `401`s, and calling the unauthenticated callback when refresh fails. | This closes the central client-side cookie refresh behavior; route-guard rendering can still be expanded separately if UX changes. |
| Frontend auth session bootstrap | done | `@org/entities-user` now has a Vitest target; `AuthBootstrap` tests cover successful `authApi.me()` setting `isAuthenticated=true` and failed bootstrap setting `isAuthenticated=false` while clearing loading state. | App-level route guard rendering can still be expanded separately if routing UX changes. |
| Frontend auth route guards | done | `@org/messenger` Jest tests cover `GuestGuard` redirecting authenticated users from login to chats, preserving the email-verified continuation route, `AppGuard` redirecting unauthenticated users to login, and allowing authenticated users into protected routes. | Covers app-level redirect behavior without re-testing `authedFetch` internals. |
| Frontend production logger no-op | done | `@org/shared` `useLogger` tests prove production builds do not call `console.log`, `console.warn`, `console.error`, or `console.debug`, while development builds still emit formatted diagnostics. | Demo must continue to use production Vite builds because `demo = prod` for logging behavior. |
| Shared client lint noise | done | `@org/shared:lint` now exits with 0 errors and 0 warnings after removing the non-null assertion, accessible-emoji warnings, and useless fragments. | Nx Cloud warnings are external workspace-connection noise and remain separate from code lint. |
| Metrics route label safety | done | `@org/core` `MetricsInterceptor` tests cover Express route templates and fallback behavior; when route metadata is unavailable, metrics now use `unknown` instead of raw request paths. | Prevents high-cardinality/PII-bearing dynamic paths in Prometheus labels. |
| Observability Docker stack runtime | done | Runtime smoke confirmed Prometheus, Grafana, Alloy, Loki, and Tempo readiness; Loki returns docker log counts; Tempo reports received spans; Prometheus `up` is `1` for all configured targets after splitting Gateway to `/api/metrics`. | Fixed stale Gateway scrape path and updated the runbook. |
| Swagger session endpoint docs | done | `@org/gateway` Swagger spec, full gateway test suite, typecheck, and lint passed after adding session response decorators. | The old Swagger drift row for session response bodies is stale. |

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
| Backend auth: registration | Registration creates credentials, emits profile/search events, and sends verification email. | `AuthService.register` hashes and persists credentials, sends `USER_PATTERNS.CREATE`, emits `USER_EVENTS.REGISTERED`, then invokes `verification.generateAndSend`; registration side effects and failure paths are covered by `auth.service.spec.ts`. | `libs/backend/auth/src/services/auth.service.spec.ts` | implemented | No action. |
| Backend auth: login | Login validates credentials, email verification, rate limiting, and ban state. | `validateCredentials` checks persisted credentials, `AdminBanService.assertAccountActive`, password hash, `isVerified`, and blocks on the fifth failed attempt as covered by boundary tests. | `libs/backend/auth/src/services/auth.service.spec.ts` | implemented | No action. |
| Backend auth: refresh | Refresh rotates token pair and detects replay or revoked sessions. | `AuthService.refresh` clears cached Redis sessions and revokes SQL sessions on revoked refresh-token replay; tests assert cached session keys and user-session index entries are removed. | `libs/backend/auth/src/services/auth.service.spec.ts` | implemented | No action. |
| Backend auth: logout | Logout revokes SQL session and Redis active session. | `AuthService.logout` hashes the refresh token, invokes `repo.revokeSession`, then removes both `session:<id>` and the user-session index at `libs/backend/auth/src/services/auth.service.ts:344-369`. | `libs/backend/auth/src/services/auth.service.spec.ts` | implemented | No action. |
| Backend auth: user sessions | Session listing, one-session revoke, and revoke-all match the spec. | Listing maps active SQL sessions and current-session state; one-session revoke clears SQL and Redis; user-facing revoke-all accepts current session context and preserves it while terminating other sessions. | `libs/backend/auth/src/services/auth.service.spec.ts`; `apps/backend/gateway/src/controllers/auth.http.spec.ts` | implemented | No action. |
| Backend auth: password recovery | Forgot/reset password hides account enumeration and revokes all sessions after an email reset. | Unknown or passwordless accounts return normally from `forgotPassword`; reset hashes the new password, clears login-attempt state, and revokes every session because the email reset-token flow has no current-session context. | `libs/backend/auth/src/services/auth.service.spec.ts` | implemented | No action unless an authenticated change-password flow is added later. |
| Backend auth: OAuth | OAuth creates or links accounts for GitHub and Google. | `AuthService.oauthLogin` covers existing provider binding reuse, new federated credentials/profile/search side effects, linked-by-email idempotent profile upsert, and auto-verification after provider linking. | `libs/backend/auth/src/services/auth.service.spec.ts` | implemented | External GitHub/Google callbacks were confirmed manually; Yandex is intentionally removed. |
| Backend auth: bans | Login ban and admin ban semantics are documented and tested. | Login calls `assertAccountActive`; `AdminBanService` persists ban state, revokes SQL/Redis sessions, and normalizes expired bans at `libs/backend/auth/src/admin/admin-ban.service.ts:113-217`. `docs/specs/auth-service.md` now documents login rate-limit ban and administrator ban as separate mechanisms. | `libs/backend/auth/src/services/auth.service.spec.ts`; `libs/backend/auth/src/admin/admin-ban.service.spec.ts`; `libs/backend/auth/src/cache/ban.redis.repo.spec.ts` | implemented | No action. |
| Backend auth: DTO validation | Zod DTOs are based on shared contracts and validation behavior is safe. | Public auth, identity, refresh, session, and OAuth message payloads are parsed through shared Zod DTOs before service code. | `libs/backend/auth/src/controllers/auth.controller.spec.ts` | implemented | No action. |
| Backend auth: logging | Logs do not expose raw password, token, reset token, OAuth code, or unsafe payloads in demo/prod. | Current `PrismaService` slow-query logs include duration and query text only; serialized Prisma `params` are not logged. | `libs/backend/core/src/observability/logger.spec.ts` | implemented | No action. |
| Gateway auth: HTTP endpoints and validation | Auth HTTP endpoints route through the gateway and validate all untrusted body, query, and parameter inputs. | Body endpoints use DTO-specific validation; `verifyEmail` query and `sessions/:id` params have Zod-backed validation and Supertest coverage. | `apps/backend/gateway/src/controllers/auth.http.spec.ts` | implemented | No action. |
| Gateway auth: token cookies | HttpOnly cookies are set and cleared with environment-appropriate options. | Gateway HTTP tests cover login cookies, refresh cookies, logout clearing, current-session revoke clearing, other-session revoke, and revoke-other-sessions. | `apps/backend/gateway/src/controllers/auth.http.spec.ts` | implemented | No action. |
| Gateway auth: refresh | Refresh reads `refresh_token`, rotates both cookies, and handles a missing token safely. | Gateway HTTP tests cover missing refresh token and successful refresh-cookie rotation. | `apps/backend/gateway/src/controllers/auth.http.spec.ts` | implemented | No action. |
| Gateway auth: logout and session revoke | Logout and session revoke call the auth microservice and clear cookies correctly. | Gateway HTTP tests cover logout, current-session revoke, non-current session revoke, and revoke-other-sessions behavior. | `apps/backend/gateway/src/controllers/auth.http.spec.ts` | implemented | No action. |
| Gateway auth: RPC errors | RPC errors map to correct HTTP responses and normalized body. | `GatewayHttpExceptionFilter` is registered globally and formats auth RPC failures as `{ statusCode, error, message, path, timestamp }`; 5xx downstream details are replaced with a safe public message. | `apps/backend/gateway/src/controllers/auth.http.spec.ts` | implemented | Document the shared error envelope in Swagger. |
| Gateway auth: OAuth redirects and callbacks | OAuth redirects and callbacks do not log or expose unsafe query data. | GitHub/Google provider/callback endpoints use guards and redirect only to configured `CLIENT_URL` at `apps/backend/gateway/src/controllers/auth.controller.ts:253-330`; logger-redaction assertions cover `token` and `tokens` in `libs/backend/core/src/observability/logger.spec.ts:36-99`; external callbacks were manually confirmed in the local/demo flow. | manual-validated | implemented | Keep provider callback smoke checks in release/demo validation. |
| Gateway auth: PII logging | Gateway auth logs do not expose raw email addresses in demo/production environments. | Gateway/auth logs use boolean or safe summaries such as `hasEmail`, and tests assert sensitive downstream messages are not emitted to diagnostic logs. | `apps/backend/gateway/src/controllers/auth.http.spec.ts` | implemented | No action. |
| Gateway auth: WebSocket access and bans | WebSocket authenticates via access cookie and enforces ban/active state. | `handleConnection` extracts `access_token`, verifies it, rejects active ban markers, emits a structured ban error, and fails closed on marker lookup failure at `apps/backend/gateway/src/gateways/chat.socket-gateway.ts:48-94`. | `apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts` | implemented | No action. |
| Gateway auth: frontend error intake | Frontend error intake validates, sanitizes, and safely logs client error data. | Frontend error controller tests assert safe metadata lengths/flags are logged, not message/stack/userAgent free text. | `apps/backend/gateway/src/controllers/frontend-error.controller.spec.ts` | implemented | No action. |
| Gateway auth: Swagger accuracy | Swagger docs match observed endpoint status codes, cookies, and response shapes. | Generated-document tests cover cookie security schemes, auth message responses, token-cookie response headers, verify-email redirect headers, normalized auth error envelopes, and session response schemas. | `apps/backend/gateway/src/controllers/auth.swagger.spec.ts` | implemented | No action unless auth endpoint contracts change. |

## Backend Auth Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |
| Repository boundary follows database-per-service ownership | `PrismaService` uses `AUTH_DATABASE_URL`; `OrgAuthModule` binds the auth repository token to `AuthPrismaRepository`; services inject the token rather than Prisma. | implemented | No action. |
| Registration side effects lack direct coverage | `AuthService.register` side effects and failure paths are covered in `auth.service.spec.ts`. | implemented | No action. |
| Rate limiter blocks attempt six, not attempt five | Login rate-limit boundary is corrected and covered by fourth/fifth attempt tests. | implemented | No action. |
| Replay revocation leaves Redis active-session state untouched | Revoked refresh-token replay clears cached session keys and user-session index entries before SQL revocation. | implemented | No action. |
| Logout has SQL and Redis cleanup coverage | `logout` revokes the hashed SQL session and removes both Redis keys; the behavior is asserted in `auth.service.spec.ts`. | implemented | No action. |
| User revoke-all also revokes the current session | User-facing revoke-all now preserves the current session when current session context is provided. | implemented | No action. |
| Password reset removes the current session and leaves the login-attempt key | Password reset now clears login-attempt state after a successful password update; reset without authenticated current-session context still revokes all sessions. | implemented | No action for login-attempt cleanup; revisit current-session retention only if reset is invoked from an authenticated flow. |
| OAuth linking needs cross-service confirmation | OAuth provider linking paths are covered by service tests, User profile creation is idempotent, and GitHub/Google callbacks were manually confirmed. | implemented | No action. |
| Administrator-ban behavior is absent from the specification | Admin-ban persistence, authorization, SQL/Redis revocation, expiry normalization, and public error contract are now documented in `docs/specs/auth-service.md`. | implemented | No action. |
| RMQ validation is partial | Auth RPC payloads are parsed through shared Zod DTOs before service code. | implemented | No action. |
| Non-production slow-query logging exposes serialized parameters | Auth Prisma slow-query logs no longer include serialized `params`. | implemented | No action. |

## Gateway Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |
| Auth validation omits verification query and session-ID parameters | Gateway query/param auth inputs are Zod-validated and covered by invalid-token/session-ID tests. | implemented | No action. |
| Token cookies have consistent secure attributes but no response-header assertions | Gateway HTTP tests assert cookie behavior across login, refresh, logout, and session revocation. | implemented | No action. |
| Refresh delegates missing-cookie rejection to Auth RPC | Missing refresh cookie behavior is covered by gateway HTTP tests and returns `401` without rotated cookies. | implemented | No action. |
| Logout and session-revoke cookie cleanup lacks gateway coverage | Gateway tests cover cookie-clearing branches for logout, current session revoke, other session revoke, and revoke other sessions. | implemented | No action. |
| Auth RPC errors use a global error envelope | `GatewayHttpExceptionFilter` normalizes auth RPC failures and strips unsafe downstream details from 5xx public responses. | implemented | Document the shared error envelope in Swagger. |
| OAuth callback security runtime validation | OAuth callbacks set cookies and redirect to configured `CLIENT_URL`; logger redaction tests cover `token` and `tokens`; GitHub/Google callbacks were manually confirmed in the local/demo flow. | implemented | Keep provider callback smoke checks in release/demo validation. |
| Auth controller logs raw email addresses | Auth controller logs now avoid raw email interpolation and use safe structured summaries. | implemented | No action. |
| Socket authorization verifies the access cookie and fails closed for bans | The socket gateway verifies `access_token`, checks `BanMarkerRepository`, emits ban-specific errors, and disconnects on invalid data; its direct test suite covers allowed, banned, unavailable, and disconnect-user cases. | implemented | No action. |
| Frontend error intake logs unsanitized free text | Frontend error intake logs safe metadata only; free-text message/stack/userAgent payloads are not emitted to logs. | implemented | No action. |
| Swagger describes the wrong cookie credential for refresh-oriented endpoints and omits some response contracts | Swagger now declares both `access_token` and `refresh_token`; refresh documents `refresh_token`, login/refresh/logout document token-cookie response headers, and register/login/reset expose concrete message schemas. Generated-document assertions cover the audited auth contracts. | implemented | No action unless auth endpoint contracts change. |

## Frontend Auth And UX Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |
| Login form uses shared validation and user-visible loading state but lacks component tests | `@org/features-auth` component tests cover login validation, loading/error states, successful navigation, and OAuth button routing. | implemented | No action. |
| Register flow leaks email into the URL after successful registration | Registration now uses transient route state for check-email instead of putting the raw email in the URL, and the no-email state is covered. | implemented | No action. |
| Register form validates shared schema plus confirm password and exposes duplicate-email errors | Register component tests cover password mismatch, duplicate email, generic server failure, loading state, and OAuth controls. | implemented | No action. |
| Forgot/reset password forms avoid rendering reset tokens but need UX/test coverage | Forgot/reset component tests cover missing token, invalid reset error, successful reset redirect, success state, and token absence from rendered output. | implemented | No action. |
| Email verified page contradicts the documented verified-cookie flow | Email verified UX is aligned with cookie-auth continuation and app route guards preserve the email-verified continuation route. | implemented | No action. |
| OAuth buttons route only GitHub and Google, while the backend spec includes Yandex | Yandex OAuth was intentionally removed from backend/gateway/frontend; GitHub and Google remain visible. | implemented | No action. |
| Session bootstrap and protected routes use cookie-based auth with refresh retry | `AuthBootstrap` calls `authApi.me()`, which uses `authedFetch`; `authedFetch` retries once through `/auth/refresh` on `401`, and `GuestGuard`/`AppGuard` use `isLoading` and `isAuthenticated` for redirects. `@org/shared` covers refresh retry/failure, `@org/entities-user` covers bootstrap success/failure, and `@org/messenger` covers app guard redirects. | implemented | Core session bootstrap, refresh fallback, and route guard redirects are covered. |
| Session revoke-all frontend matches current backend behavior but not the spec wording | `useSessions.revokeAllSessions` invalidates the sessions query without forcing logout, matching the backend/gateway revoke-other-sessions semantics. | implemented | No action. |
| Frontend logging is disabled only for Vite production builds | `useLogger` returns no-op methods when `import.meta.env.PROD` is true, and `@org/shared` tests assert production builds do not call browser console methods. | implemented | Demo must be served as a production Vite build to keep `demo = prod` logging behavior. |

## Visual Review

| Viewport | Route Or Component | Observation | Status | Follow-up |
| --- | --- | --- | --- | --- |
| Static mobile/desktop | `libs/client/layouts/auth/src/auth-layout.tsx` | Auth pages are covered by Playwright mobile/desktop checks for horizontal overflow and interactive-element viewport overflow. | implemented | No action. |
| Static mobile/desktop | `libs/client/features/auth/src/ui/login-form.tsx` | Component tests cover validation/loading/API errors, and visual baselines cover the route at desktop and mobile sizes. | implemented | No action. |
| Static mobile/desktop | `libs/client/features/auth/src/ui/register-form.tsx` | Component tests cover password confirmation and API errors; e2e verifies successful redirect without leaking email into the URL; visual baselines cover the route. | implemented | No action. |
| Static mobile/desktop | `libs/client/features/auth/src/ui/forgot-password-form.tsx` | Component tests cover success and error states; visual baselines cover the route. | implemented | No action. |
| Static mobile/desktop | `libs/client/features/auth/src/ui/reset-password-form.tsx` | Component tests cover missing token, invalid reset, successful reset, redirect, and token absence from rendered output; visual baselines cover token and no-token routes. | implemented | No action. |
| Static mobile/desktop | `libs/client/features/auth/src/ui/check-email-screen.tsx` | Registration uses route state instead of query email, direct visits do not expose resend, and visual baselines cover the route. | implemented | No action. |
| Static mobile/desktop | `libs/client/features/auth/src/ui/email-verified-screen.tsx` | Email-verified UX is aligned with cookie-auth continuation; route-guard and e2e coverage preserve the continuation route. | implemented | No action. |
| Static mobile/desktop | `libs/client/features/auth/src/ui/oauth-buttons.tsx` | Yandex OAuth was intentionally removed; GitHub and Google remain visible and auth page baselines cover the button stack. | implemented | No action. |

## Observability And Logging Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |
| Backend structured logger redacts common sensitive keys and strips query strings | `createLoggerOptions` configures Pino redaction for token/password/cookie/auth/env-secret fields and serializes request URLs through `stripQueryString`; `logger.spec.ts` asserts redaction paths and `/api/auth/verify-email?token=...` becomes `/api/auth/verify-email`. | implemented | No action for field-path redaction; keep specific embedded-string findings tracked separately. |
| Field-path redaction does not protect embedded strings or Prisma query params | Gateway/auth raw email interpolation, frontend-error free-text logging, auth Prisma `params`, and frontend `apiFetch` console logging have been removed or covered by safe-output tests. | implemented | No action. |
| Zod validation errors are not normalized through a global gateway exception filter | `ZodValidationExceptionFilter` is registered globally and logs method, path, status, and sanitized issue metadata without raw request payloads; gateway HTTP tests assert validation failures are logged safely. | implemented | No action for Zod validation; RPC error envelope remains tracked separately. |
| Frontend error reporter strips query/hash from route before sending | `reportFrontendError` sends `window.location.pathname`, and its spec proves `/reset-password?token=secret#confirm` is reported as `/reset-password`. | implemented | No action for route query stripping. |
| Frontend error intake logs unsanitized free text after reporter submission | Gateway frontend-error intake logs safe metadata only and does not log message/stack/userAgent free text. | implemented | No action. |
| Shared `apiFetch` logs every request and response with `console.log` | `apiFetch` has no `console.*` calls, and shared API client specs assert request/response URLs are not written to the browser console. | implemented | No action. |
| `useLogger` is production-build gated but not explicitly demo-aware | `useLogger` returns no-op methods when `import.meta.env.PROD` is true, and `@org/shared` tests assert no browser console methods are called in production mode. | implemented | Keep demo deployed from a production Vite build; add deployment-level checks separately if hosting config changes. |
| Health, readiness, and metrics endpoints match the observability document | `HealthController` exposes `/health/live` and `/health/ready`; `MetricsController` exposes `/metrics`; `MetricsService` registers default metrics and `polygon_http_requests_total`/duration histograms. | implemented | No action. |
| Metrics route labels may use raw dynamic paths when route metadata is absent | `MetricsInterceptor` now uses `request.route?.path ?? 'unknown'`, and `@org/core` tests assert route templates are preserved while fallback labels do not use raw `request.path`. | implemented | No action. |
| Tracing enablement follows `OTEL_ENABLED=true` and exports OTLP HTTP traces | `startTelemetry` no-ops in tests or unless `OTEL_ENABLED` is `true`, sets service name/version/environment resources, and sends traces to `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`. | implemented | No action. |
| Prometheus/Loki/Tempo/Alloy/Grafana config matches the single-host stack at a file level | Prometheus scrapes gateway/user/search and auth/chat/media/notification metrics ports; Alloy tails Docker logs and forwards traces to Tempo; Grafana datasources provision Prometheus/Loki/Tempo. Runtime observability stack was manually confirmed during the audit. | implemented | Keep observability smoke checks in release/demo validation. |

## Swagger Drift

| Endpoint Or Schema | Observed Behavior | Swagger Documentation | Status | Follow-up |
| --- | --- | --- | --- | --- |
| `POST /api/auth/login` response cookies | Login sets HttpOnly `access_token` and `refresh_token` with Strict SameSite, production-only Secure, and configured max ages (`auth.controller.ts:100-110,401-422`). | Swagger documents both token `Set-Cookie` response headers and generated-document assertions cover them. | implemented | No action. |
| `POST /api/auth/register` response body | The handler returns `{ message: 'Registered successfully' }` after Auth RPC success (`auth.controller.ts:69-76`). | `201` has a concrete message-body schema and generated-document coverage. | implemented | No action. |
| `POST /api/auth/login` response body | The handler returns `{ message: 'Logged in successfully' }` after setting cookies (`auth.controller.ts:100-112`). | `201` has a concrete message-body schema and generated-document coverage. | implemented | No action. |
| `POST /api/auth/resend-verification` response body | The handler returns `{ message: 'Verification email sent' }` (`auth.controller.ts:196-207`). | `201` now has a concrete message-body schema and generated-document coverage. | implemented | No action. |
| `POST /api/auth/forgot-password` response body | The handler returns `{ message: 'If this email is registered, a reset link has been sent' }` (`auth.controller.ts:219-229`). | `201` now has a concrete enumeration-safe message-body schema and generated-document coverage. | implemented | No action. |
| `POST /api/auth/reset-password` response body | The handler returns `{ message: 'Password reset successfully' }` (`auth.controller.ts:236-249`). | `201` has a concrete message-body schema and generated-document coverage. | implemented | No action. |
| `POST /api/auth/logout` cookie requirement and response | Logout reads `refresh_token`, conditionally invokes Auth logout, then clears both token cookies; it has no auth guard (`auth.controller.ts:115-134,425-430`). | Swagger no longer advertises an access-cookie requirement, and `201` documents both cleared cookies plus `{ message: 'Logged out successfully' }`. | implemented | No action. |
| `POST /api/auth/refresh` cookie requirement and response | Refresh reads `refresh_token`, forwards it to Auth RPC, and writes both replacement cookies (`auth.controller.ts:137-158,401-422`). | Swagger documents `refresh_token` as the request credential, both rotated cookies, and `{ message: 'Tokens refreshed' }`. | implemented | No action. |
| `GET /api/auth/verify-email` response cookies | A valid query token produces two auth cookies and `res.redirect` to `${CLIENT_URL}/auth/email-verified` (`auth.controller.ts:161-186`). | `302` now documents `Location` and `Set-Cookie` headers, has no request-cookie security scheme, and generated-document coverage asserts both. | implemented | No action. |
| `/api/auth/sessions`, `/api/auth/sessions/:id` | List returns `SessionResponse[]`; single revoke returns `{ message: 'Session revoked' }`; revoke-other-sessions returns `{ message: 'Other sessions revoked' }`, and each is guarded by session and active-account checks. | Session endpoints now document `200`, `401`, and `403` responses with concrete session/message schemas and generated-document coverage. | implemented | No action. |

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
| `rg -n "Controller\\('auth|Post\\(|Get\\(|Delete\\(|ApiOperation|ApiResponse|ApiCookieAuth|cookie|clearCookie|refresh_token|access_token|ZodValidationPipe|Logger|send\\(|catchError|Unauthorized|SwaggerModule|DocumentBuilder" apps/backend/gateway/src` | pass | Exit `0`; captured `auth.controller.ts:54:@Controller('auth')`, `auth.controller.ts:137:@Post('refresh')`, `auth.controller.ts:411:    res.cookie('access_token', tokens.accessToken, {`, `chat.socket-gateway.ts:53:      .find((c) => c.startsWith('access_token='))`, and `main.ts:45:      .addCookieAuth('access_token')`. |
| `sed -n '1,520p' apps/backend/gateway/src/controllers/auth.controller.ts` | pass | Exit `0`; captured `@UsePipes(new ZodValidationPipe(RegisterDto))` at line 64, raw `@Query('token')` at line 167, `res.clearCookie('refresh_token', opts)` at line 430, and `throw new HttpException(message, status)` at line 454. |
| `sed -n '1,140p' apps/backend/gateway/src/controllers/frontend-error.controller.ts` | pass | Exit `0`; captured `frontendErrorSchema.safeParse(body)` at line 11 and `this.logger.error({ eventType: 'frontend_error', ...result.data })` at lines 17-20. |
| `sed -n '1,340p' apps/backend/gateway/src/gateways/chat.socket-gateway.ts` | pass | Exit `0`; captured access-cookie extraction at lines 49-54, `verifyAccessToken(token)` at line 63, active-ban lookup at line 71, and fail-closed disconnect at lines 82-86. |
| `sed -n '1,120p' apps/backend/gateway/src/main.ts` | pass | Exit `0`; captured `app.use(cookieParser())` at line 37, global `ZodValidationPipe` at line 38, and dev-only Swagger configuration with `.addCookieAuth('access_token')` at lines 40-48. |
| `sed -n '1,180p' apps/backend/gateway/src/app/gateway.module.ts` | pass | Exit `0`; captured `AuthGatewayController` and `FrontendErrorController` registrations at lines 82-90 and the global `ThrottlerGuard` provider at lines 92-104; no exception-filter provider is registered. |
| `sed -n '1,460p' apps/backend/gateway/src/controllers/admin.controller.spec.ts` | pass | Exit `0`; captured cookie-parser test setup at line 195, access-cookie test requests at lines 206-209, and Auth-RPC `403` propagation assertion at lines 255-274. |
| `sed -n '1,120p' apps/backend/gateway/src/controllers/frontend-error.controller.spec.ts` | pass | Exit `0`; captured the structured `frontend_error` logging assertion at lines 18-40 and invalid overlength-message rejection at lines 42-52; neither test embeds a token/PII string. |
| `sed -n '1,220p' apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts` | pass | Exit `0`; captured verified access-cookie/ban-marker coverage at lines 122-131, banned-socket disconnect at lines 133-149, and fail-closed marker-error coverage at lines 151-162. |
| `rg -n -C 3 "cookie|refresh|logout|WebSocket|socket|Swagger|frontend|OAuth|error|auth" docs/specs/gateway-service.md docs/OBSERVABILITY.md docs/specs/auth-service.md` | pass | Exit `0`; confirmed cookie JWT, refresh rotation, WebSocket cookie auth, dev Swagger, and global exception-filter requirements. |
| `rg --files apps/backend/gateway/src/controllers | rg 'auth\\.controller\\.spec\\.ts$|\\.spec\\.ts$'` | pass | Exit `0`; found only `admin.controller.spec.ts`, `frontend-error.controller.spec.ts`, and `media.controller.spec.ts`, confirming the auth-controller test gap. |
| `rg -n "LoginForm\|RegisterForm\|ForgotPasswordForm\|ResetPasswordForm\|OAuthButtons\|useLogin\|useRegister\|useLogout\|useSessions\|useSessionStore\|AuthProvider\|authedFetch\|refresh\|Protected\|Navigate\|CLIENT_ROUTES\|toast\|useLogger\|reportFrontendError" apps/client/messenger/src libs/client/features/auth/src libs/client/pages/auth libs/client/entities/user/src libs/client/shared/src` | pass | Exit `0`; captured form/model/session/router/logging references including `use-login.ts:19:navigate(CLIENT_ROUTES.chats.root)`, `use-register.ts:21:navigate(...checkEmail?email=...)`, `authed-fetch.ts:28:await refreshOnce()`, and `guards.tsx` redirects. |
| `sed` reads for auth form components | pass | Exit `0`; captured `LoginForm` using `loginSchema`, `RegisterForm` extending `registerSchema` with `confirmPassword`, `ResetPasswordForm` reading `useSearchParams().get('token')`, and `OAuthButtons` provider list containing only `github` and `google`. |
| `sed` reads for auth models/session/router/pages | pass | Exit `0`; captured `AuthBootstrap` calling `authApi.me()`, `configureAuthedFetch(() => setAuthenticated(false))`, `GuestGuard` redirecting authenticated users to chats, `EmailVerifiedScreen` navigating to login, and `CheckEmailPage` reading `email` from query params. |
| `sed` reads for AuthLayout/Input/Button | pass | Exit `0`; captured `AuthLayout` centered content with `min-h-screen` and `p-7` but no width or mobile padding cap; `Input` renders error text as `text-xs`; `Button` disables while `loading`. |
| `rg --files libs/client/features/auth libs/client/pages/auth libs/client/entities/user apps/client/messenger/src | rg '(spec|test)\\.(ts|tsx)$'` | fail | Exit `1`; no auth feature/page/entity/messenger auth spec files were found in the searched paths. |
| `sed -n '1,220p' libs/backend/core/src/observability/logger.ts` and `logger.spec.ts` | pass | Exit `0`; captured redaction paths for token/password/cookie/env secrets and query stripping test for `/api/auth/verify-email?token=secret-token&code=oauth-code`. |
| `sed` reads for backend health, metrics, interceptor, and telemetry | pass | Exit `0`; captured `/health/live`, `/health/ready`, `/metrics`, `polygon_http_requests_total`, route fallback `request.route?.path ?? request.path`, and OTEL guard `OTEL_ENABLED !== 'true'`. |
| `sed` reads for frontend error reporter and `useLogger` | pass | Exit `0`; captured `route: window.location.pathname`, fetch to `/api/observability/frontend-errors`, query/hash stripping test, and `useLogger` no-op only under `import.meta.env.PROD`. |
| `sed` reads for observability infrastructure files | pass | Exit `0`; captured Prometheus `polygon-backend` targets, alert rules for service down/5xx/p95/disk/CPU, Alloy Docker log and OTLP pipelines, Loki/Tempo retention config, and Grafana Prometheus/Loki/Tempo datasources. |
| `rg -n "logger\\.(debug\|verbose\|log\|warn\|error)\|console\\.(log\|debug\|error\|warn)\|useLogger\|password\|token\|refreshToken\|accessToken\|cookie\|authorization\|email\|dto\|payload\|req\\.body\|req\\.headers\|query" ...` | pass | Exit `0`; captured gateway email log interpolation, frontend-error logging, auth Prisma logging, `apiFetch` unconditional `console.log`, and frontend reset/check-email token/email handling. |
| `npm exec nx test @org/auth` | pass | Exit `0`; 6 suites and 125 tests passed. Output includes expected Nest error logs from negative-path tests plus Nx Cloud 401/unconnected-workspace warning. |
| `npm exec nx test @org/gateway` | pass | Exit `0`; 4 suites and 20 tests passed. Nx reported `@org/gateway:test` as flaky and emitted Nx Cloud 401/unconnected-workspace warning. |
| `npm exec nx test @org/shared` | pass | Exit `0`; Vitest 1 file and 2 tests passed. Nx Cloud emitted the unconnected-workspace warning. |
| `npm exec nx test @org/core` | pass | Exit `0`; 7 suites and 31 tests passed. Output includes Node `NO_COLOR`/`FORCE_COLOR` warnings and Nx Cloud 401/unconnected-workspace warning. |
| `npm exec nx test @org/messenger` | fail | Exit `130`; dependent client builds fail because `libs/client/shared/src/lib/observability/frontend-error-reporter.ts:1:15` imports `FrontendErrorPayload` from `@org/common`, but `@org/common` does not export it. |
| `npm exec nx lint @org/auth` | pass-with-warnings | Exit `0`; `github.strategy.ts:28:10` and `google.strategy.ts:28:10` use explicit `any`. |
| `npm exec nx lint @org/gateway` | pass | Exit `0`; no lint findings beyond environment/Nx Cloud warnings. |
| `npm exec nx lint @org/messenger` | pass-with-warnings | Exit `0`; `apps/client/messenger/sw.ts:27:38` has `array-callback-return`. |
| `npm exec nx lint @org/features-auth` | pass | Exit `0`; no lint findings. |
| `npm exec nx lint @org/entities-user` | pass | Exit `0`; no lint findings. |
| `npm exec nx lint @org/shared` | pass-with-warnings | Exit `0`; includes `no-console` at `libs/client/shared/src/lib/api/client.ts:14:3` and `:25:3`, plus existing non-null assertion, accessible emoji, and useless-fragment warnings. |
| `npm exec nx lint @org/core` | pass | Exit `0`; no lint findings. |
| `npm exec nx typecheck @org/auth` | pass | Exit `0`; dependencies completed from local cache or direct run. Nx reported `@org/common:typecheck` as flaky. |
| `npm exec nx typecheck @org/auth-service` | pass | Exit `0`; dependencies completed from local cache or direct run. Nx reported `@org/common:typecheck` as flaky. |
| `npm exec nx typecheck @org/core` | pass | Exit `0`; dependencies completed from local cache or direct run. |
| `npm exec nx typecheck @org/gateway` | fail | Exit `1`; `frontend-error.controller.ts` imports missing `frontendErrorSchema` and `FrontendErrorPayload` exports from `@org/common`, and its spec hits a stale declaration-build error after the compile failure. |
| `npm exec nx typecheck @org/shared` | fail | Exit `1`; `@org/shared:typecheck` reports stale `@org/common/dist/index.d.ts` output and the frontend-error reporter import path is part of the failing dependency chain. |
| `npm exec nx typecheck @org/entities-user` | fail | Exit `130`; dependent `@org/shared:typecheck` and `@org/entities-user:build` fail on missing `FrontendErrorPayload` from `@org/common`. |
| `npm exec nx typecheck @org/features-auth` | fail | Exit `130`; dependent `@org/shared:typecheck` and `@org/entities-user:build` fail on missing `FrontendErrorPayload` from `@org/common`. |
| `npm exec nx typecheck @org/messenger` | fail | Exit `130`; multiple dependent client package builds fail on missing `FrontendErrorPayload` from `@org/common`. |
| `npm exec nx build @org/auth-service` | pass | Exit `0`; webpack compiled successfully. |
| `npm exec nx build @org/gateway` | pass | Exit `0`; webpack compiled successfully, despite separate `typecheck` failure. |
| `npm exec nx build @org/messenger` | fail | Exit `130`; frontend dependency builds fail on missing `FrontendErrorPayload` from `@org/common`. |

## Manual Validation Points

| Flow | Why Manual | Required User Help | Status |
| --- | --- | --- | --- |
| OAuth account creation and linking for GitHub and Google | Auth-service tests prove existing provider binding reuse, new federated credentials/profile/search side effects, linked-by-email idempotent profile upsert, and auto-verification. External GitHub/Google callbacks were confirmed manually by user. | Keep provider callback smoke checks in release/demo validation. | implemented |
| Auth log redaction in JSON and pretty modes | Static Pino redaction configuration exists and token-bearing auth flows were manually checked during local/demo validation. | Keep log-redaction smoke checks in release/demo validation when auth logging changes. | implemented |
| Real verification email delivery | Static review proves auth emits notification events; user confirmed SMTP is working, emails arrive, and verification links are usable. | Keep real-email smoke checks in release/demo validation. | implemented |
| Real password reset email delivery | Static review proves reset-token generation and notification event emission; user confirmed SMTP delivery works, and reset behavior now explicitly revokes all sessions. | Keep real-email reset smoke checks in release/demo validation. | implemented |
| Browser cookie behavior in demo/prod mode | Cookie attributes are covered by gateway tests and browser auth/session flows were manually checked in the local/demo environment. | Keep login, refresh, logout, verify-email, session revoke, and revoke-all smoke checks in release/demo validation. | implemented |
| Auth pages visual behavior | Playwright visual/overflow checks cover `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password?token=demo`, `/auth/reset-password`, `/auth/check-email`, and `/auth/email-verified` at mobile and desktop widths. | Keep baselines updated when auth UI changes. | implemented |
| Frontend OAuth provider availability | User confirmed Yandex should be removed; backend/gateway/frontend now expose GitHub and Google only. | No action. | implemented |
| Docker observability stack | File inspection and user-confirmed runtime smoke cover scrape health, Loki ingestion, Tempo trace flow, and Grafana visibility. | Keep observability smoke checks in release/demo validation. | implemented |

## Decisions Recorded

| Decision | Context | Chosen Behavior | Follow-up |
| --- | --- | --- | --- |
| Reset-token password reset session behavior | Reset-token flow has no `currentSessionId` input, clears login attempts, and revokes all sessions after password change. | Email reset revokes all sessions. Preserving the current session belongs to a future authenticated change-password flow, not this endpoint. | No action unless an authenticated change-password flow is added later. |
| Forgot/reset/login public error detail | Forgot-password must avoid account enumeration; login/reset can still return user-actionable messages when they do not expose account existence beyond the attempted login flow. | Keep enumeration-safe public messages and put diagnostic detail only in sanitized internal logs. | Keep future auth errors reviewed for enumeration and PII leakage. |

## Prioritized Follow-Up Work

| Priority | Work Item | Reason | Suggested Test Level |
| --- | --- | --- | --- |
| P0 | Document gateway error envelope in Swagger. | Done: generated Swagger assertions cover representative auth error responses using the normalized `{ statusCode, error, message, path, timestamp }` envelope. | No action unless the envelope changes. |
| P1 | Finish remaining Swagger/OpenAPI drift. | Done for audited auth endpoints: register/login/reset message schemas, login/refresh/logout cookie documentation, and refresh-token credential use are covered by `auth.swagger.spec.ts`. | Keep future auth endpoint changes covered by generated-document assertions. |
| P1 | Decide reset-token session semantics. | Done: email reset revokes all sessions because the request has no current-session context; this is now explicit in the spec and covered by auth service tests. | No action unless an authenticated change-password flow is added later. |
| P2 | Runtime-smoke auth delivery and cookies. | Done: SMTP delivery, auth emails, browser login/session/cookie behavior, and OAuth provider callbacks were manually validated during the audit. | Keep these smoke checks in release/demo validation. |
| P2 | Prove observability stack at runtime. | Done: observability runtime smoke was manually validated during the audit. | Keep Docker observability smoke checks in release/demo validation. |
| P3 | Correct Swagger/OpenAPI drift after behavior decisions. | Done: Swagger docs match the selected auth contracts and generated-document assertions cover the audited endpoints. | Keep generated OpenAPI/controller metadata tests updated when auth contracts change. |
| P3 | Clean existing Nx Cloud/flaky task noise. | Code lint noise for `@org/shared` is closed; Nx Cloud connection warnings and occasional flaky-task reports still come from workspace/CI cache behavior. | CI cache/flaky-task investigation. |

## Recommended Test Additions

| Level | Project | Test Gap | Suggested Coverage |
| --- | --- | --- | --- |
| Gateway integration | `@org/gateway` | Runtime RPC error envelope is covered for auth 4xx/5xx responses. | Keep future gateway error tests focused on new controllers or new error-envelope fields. |
| Integration | `@org/messenger` / `@org/entities-user` / `@org/shared` | Core session bootstrap, refresh retry, and app route guard redirects are covered. | Keep future app/router tests scoped to new redirect UX changes; do not re-test `authedFetch` refresh internals there. |
| Swagger | `@org/gateway` | Auth endpoint docs now cover concrete message schemas and cookie schemes for the audited flows. | Keep `auth.swagger.spec.ts` as the regression suite for future auth OpenAPI edits. |
