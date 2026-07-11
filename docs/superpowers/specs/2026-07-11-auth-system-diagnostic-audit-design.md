# Auth System Diagnostic Audit Design

## Goal

Run a diagnostic audit of the authentication system, gateway integration, frontend auth experience, and observability setup before making fixes. The audit must identify real gaps, separate bugs from intended behavior, and produce a prioritized testing and remediation map.

## Scope

The audit covers:

- Auth backend behavior in `libs/backend/auth` and `apps/backend/auth-service`.
- Gateway auth surface in `apps/backend/gateway`.
- Frontend auth, session, and user-facing behavior in `apps/client/messenger`, `libs/client/features/auth`, `libs/client/pages/auth`, `libs/client/entities/user`, and shared client utilities.
- Observability code and configuration in `libs/backend/core`, gateway frontend-error intake, `libs/client/shared`, `docs/OBSERVABILITY.md`, and `infra/observability`.
- Existing tests, Nx targets, lint, typecheck, and build coverage relevant to auth and observability.

The audit does not implement fixes directly. Any code change discovered as necessary will be recorded as a follow-up task with evidence and priority.

## Source Documents

The audit must use these documents as the source of expected behavior:

- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/MONOREPO_GOTCHAS.md`
- `docs/specs/auth-service.md`
- `docs/specs/gateway-service.md`
- `docs/specs/client-messenger.md`
- `docs/OBSERVABILITY.md`

## Classification Model

Each checked item must receive one of these statuses:

- `implemented`: code and tests match the documented expectation.
- `implemented-no-test`: behavior appears implemented, but direct test coverage is missing or weak.
- `bug`: behavior contradicts the spec or likely breaks the user flow.
- `missing-from-spec`: code contains behavior that is not documented clearly enough.
- `missing-from-code`: spec requires behavior that is absent from implementation.
- `intended-behavior`: current behavior differs from a first intuition, but is justified by architecture, security, or product constraints.
- `needs-decision`: the correct behavior is ambiguous and requires user/product confirmation.
- `needs-manual-validation`: behavior depends on real email, OAuth provider callbacks, browser cookies, Docker services, or visual inspection.

## Audit Areas

### 1. Spec vs Code Matrix

Build a matrix from the auth, gateway, client, and observability specs. For each acceptance criterion or important nuance, record:

- expected behavior from spec,
- current implementation location,
- existing tests,
- status from the classification model,
- evidence,
- follow-up action if needed.

### 2. Backend Auth

Check these areas:

- registration and duplicate email handling,
- login and account state checks,
- login rate limiting and account ban behavior,
- email verification and resend cooldown,
- forgot/reset password security behavior,
- refresh token rotation and replay protection,
- logout and session revocation,
- session listing and device metadata,
- Redis-backed instant revoke expectations,
- OAuth account creation and linking,
- RabbitMQ event emission to User, Search, and Notification services,
- Zod DTO usage and validation errors,
- repository-pattern compliance and database-per-service boundaries,
- sensitive data handling in logs.

### 3. Gateway

Check these areas:

- all auth HTTP endpoints exposed through gateway only,
- HttpOnly cookie setting and clearing,
- secure cookie options by environment,
- guards and active account checks,
- refresh endpoint behavior,
- session revoke behavior from gateway to auth service,
- RPC error mapping to HTTP responses,
- global exception normalization gap,
- OAuth redirects and callback behavior,
- WebSocket authentication from cookie,
- frontend error intake route and payload sanitization,
- request logging without query strings or tokens.

### 4. Frontend Auth and UX

Check these areas:

- login, register, forgot password, reset password, email verified, and check email pages,
- client-side Zod or form validation consistency with shared schemas,
- server-side error display and field-level messages,
- loading and disabled states,
- redirects after auth success and failure,
- session bootstrap on app load,
- automatic refresh retry after 401,
- logout/session state cleanup,
- protected route behavior,
- OAuth button behavior,
- mobile layout and responsive auth pages,
- visual defects such as overflow, overlapping text, unstable layout, inaccessible focus states, or misleading empty/error states,
- UX improvement opportunities that reduce confusion without changing security assumptions.

### 5. Observability and Logging

Check these areas:

- backend structured logging configuration,
- redaction coverage for passwords, tokens, cookies, headers, URLs, and environment secrets,
- whether debug/verbose logs can expose personal data in non-production environments,
- production logging level expectations,
- Zod validation error visibility without leaking sensitive payloads,
- frontend error reporter behavior and route sanitization,
- health, readiness, and metrics endpoints,
- OpenTelemetry enablement and exporter configuration,
- Prometheus, Loki, Tempo, Alloy, and Grafana configuration consistency,
- logs or metrics needed to diagnose auth failures, email delivery, OAuth callbacks, refresh replay, and frontend crashes.

Logging recommendations must distinguish between:

- `development`: enough diagnostic data to debug locally, with secrets still redacted.
- `demo`: production-like logging rules. Demo must not expose raw user data, secrets, tokens, reset links, OAuth query data, or verbose diagnostic payloads.
- `production`: structured operational signals only, no raw user secrets, no token values, no reset or OAuth query data.

Demo and production are treated as equivalent for user-data safety. Development may include richer diagnostic context only when secrets and unsafe user payloads are still redacted.

### 6. Testing Levels

Determine the minimum test levels needed for confidence:

- backend unit tests for auth service and repositories,
- gateway integration tests with mocked microservices using Supertest,
- shared schema tests for Zod contracts,
- frontend component tests for auth forms and auth pages,
- frontend integration tests for session bootstrap and protected routes,
- visual checks for auth pages on desktop and mobile viewports,
- observability unit tests for redaction and frontend error reporting,
- manual validation for real email delivery, OAuth providers, Docker observability stack, and browser cookie behavior.

## Verification Commands

Use Nx commands through the workspace package manager. Candidate commands:

```bash
npm exec nx test @org/auth
npm exec nx test @org/gateway
npm exec nx test @org/messenger
npm exec nx test @org/shared
npm exec nx test @org/core
npm exec nx lint @org/auth
npm exec nx lint @org/gateway
npm exec nx lint @org/messenger
npm exec nx lint @org/features-auth
npm exec nx typecheck @org/auth
npm exec nx typecheck @org/auth-service
npm exec nx typecheck @org/gateway
npm exec nx typecheck @org/messenger
npm exec nx build @org/auth-service
npm exec nx build @org/gateway
npm exec nx build @org/messenger
```

The exact command set can be narrowed during implementation based on dependency cost and which projects contain relevant tests.

## Audit Output

The audit should produce a written report with:

- a spec-to-code matrix,
- confirmed implemented behaviors,
- bugs and missing implementation,
- behaviors that are probably intended,
- decisions needed from the user,
- manual validation checklist,
- frontend visual and UX findings,
- observability/logging findings,
- Swagger documentation mismatches to fix after the behavioral audit,
- prioritized follow-up work,
- recommended test additions by level.

## Success Criteria

The audit is complete when:

- every auth-related acceptance criterion in the selected specs has a classification,
- frontend behavior and visual risks are represented, not treated as secondary,
- observability and logging risks are explicitly classified,
- commands run and their results are recorded,
- manual checks are separated from automated checks,
- Swagger documentation has been checked against the observed gateway API and any mismatch is listed for final correction,
- no code fixes are made before the follow-up implementation plan is approved.
