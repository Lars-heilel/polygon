# Auth System Diagnostic Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a diagnostic audit report for auth, gateway, frontend auth UX, observability, testing gaps, and Swagger drift before making fixes.

**Architecture:** This plan does not change production code. It creates a single audit report, populates it from source docs, code inspection, Nx verification commands, and manual/visual validation notes, then classifies each finding as implemented, bug, missing, intended, needs decision, or needs manual validation.

**Tech Stack:** Nx monorepo, NestJS, React, Vite, Zustand, TanStack Query, Zod, Jest, Supertest, Swagger/OpenAPI, Grafana/Prometheus/Loki/Tempo/Alloy.

## Global Constraints

- Use `docs/superpowers/specs/2026-07-11-auth-system-diagnostic-audit-design.md` as the approved audit design.
- Read and follow `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, and `docs/MONOREPO_GOTCHAS.md` before classifying behavior.
- Use Nx through the package manager, for example `npm exec nx test @org/auth`.
- Do not implement fixes during this audit plan.
- Treat `demo` as production-like for logging and user-data safety.
- Do not classify frontend behavior without checking both code behavior and user-facing UX/visual impact.
- Record real command outputs, including failures, in the audit report.
- Separate automated checks from manual validation points.
- Check Swagger documentation drift after behavioral API audit and list mismatches for final correction.

---

## File Structure

- Create: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`
  - Main audit report with source map, spec-to-code matrix, command results, frontend UX findings, observability/logging findings, Swagger drift, manual validation points, and prioritized follow-up work.
- Modify: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`
  - Every task appends evidence and classifications to this single report.
- Read: `docs/superpowers/specs/2026-07-11-auth-system-diagnostic-audit-design.md`
  - Approved design constraints.
- Read: `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/MONOREPO_GOTCHAS.md`
  - Required architecture and monorepo constraints.
- Read: `docs/specs/auth-service.md`, `docs/specs/gateway-service.md`, `docs/specs/client-messenger.md`, `docs/OBSERVABILITY.md`
  - Expected behavior.
- Inspect: `libs/backend/auth/src/**`, `apps/backend/auth-service/src/**`, `apps/backend/gateway/src/**`
  - Backend and gateway implementation.
- Inspect: `apps/client/messenger/src/**`, `libs/client/features/auth/src/**`, `libs/client/pages/auth/**`, `libs/client/entities/user/src/**`, `libs/client/shared/src/**`
  - Frontend auth implementation, session behavior, shared fetch/logging/error utilities.
- Inspect: `libs/backend/core/src/observability/**`, `infra/observability/**`
  - Observability implementation and deployment config.

---

### Task 1: Create Audit Report Scaffold

**Files:**
- Create: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`

**Interfaces:**
- Consumes: approved design in `docs/superpowers/specs/2026-07-11-auth-system-diagnostic-audit-design.md`
- Produces: report sections that later tasks populate with evidence

- [ ] **Step 1: Create the report directory**

Run:

```bash
mkdir -p docs/audits
```

Expected: command exits with code `0`.

- [ ] **Step 2: Create the report scaffold**

Create `docs/audits/2026-07-11-auth-system-diagnostic-audit.md` with this exact structure:

```markdown
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
| `docs/ARCHITECTURE.md` | no | |
| `docs/DEVELOPMENT.md` | no | |
| `docs/MONOREPO_GOTCHAS.md` | no | |
| `docs/specs/auth-service.md` | no | |
| `docs/specs/gateway-service.md` | no | |
| `docs/specs/client-messenger.md` | no | |
| `docs/OBSERVABILITY.md` | no | |

## Nx Project Targets Reviewed

| Project | Targets checked | Notes |
| --- | --- | --- |

## Spec-To-Code Matrix

| Area | Expected Behavior | Implementation Evidence | Existing Tests | Status | Follow-up |
| --- | --- | --- | --- | --- | --- |

## Backend Auth Findings

| Item | Evidence | Status | Follow-up |
| --- | --- | --- | --- |

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
```

Expected: report file exists and contains every section above.

- [ ] **Step 3: Commit the scaffold**

Run:

```bash
git add docs/audits/2026-07-11-auth-system-diagnostic-audit.md
git commit -m "docs: scaffold auth diagnostic audit report"
```

Expected: commit succeeds.

---

### Task 2: Build Source And Target Map

**Files:**
- Modify: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`

**Interfaces:**
- Consumes: report scaffold from Task 1
- Produces: completed `Source Documents Reviewed` and `Nx Project Targets Reviewed` sections

- [ ] **Step 1: Re-read required source documents**

Run:

```bash
sed -n '1,260p' docs/ARCHITECTURE.md
sed -n '1,280p' docs/DEVELOPMENT.md
sed -n '1,260p' docs/MONOREPO_GOTCHAS.md
sed -n '1,280p' docs/specs/auth-service.md
sed -n '1,260p' docs/specs/gateway-service.md
sed -n '1,260p' docs/specs/client-messenger.md
sed -n '1,260p' docs/OBSERVABILITY.md
```

Expected: each command exits with code `0`. If a document is longer than the range, run another `sed -n` range until the needed auth/observability content has been read.

- [ ] **Step 2: Record source document review**

Update `Source Documents Reviewed` so every required document has `Reviewed` set to `yes`. Notes must include one short constraint per document:

```markdown
| `docs/ARCHITECTURE.md` | yes | Cookie auth through gateway, database-per-service, RabbitMQ events, FSD package boundaries. |
| `docs/DEVELOPMENT.md` | yes | Nx targets, strict TypeScript, Nest repository pattern, package boundary rules. |
| `docs/MONOREPO_GOTCHAS.md` | yes | Vite proxy, Tailwind source scanning, MSW layout, gateway Supertest strategy. |
| `docs/specs/auth-service.md` | yes | Auth acceptance criteria and known gaps for bans, instant revoke, email templates. |
| `docs/specs/gateway-service.md` | yes | Gateway auth/cookie/WebSocket behavior and known gaps for exception filter, instant revoke, roles. |
| `docs/specs/client-messenger.md` | yes | Client auth/session bootstrap and frontend UX expectations. |
| `docs/OBSERVABILITY.md` | yes | Metrics, logs, traces, frontend error intake, redaction and retention expectations. |
```

Expected: report records source review with concrete constraints.

- [ ] **Step 3: Capture Nx targets for relevant projects**

Run:

```bash
npm exec nx show project @org/auth --json
npm exec nx show project @org/auth-service --json
npm exec nx show project @org/gateway --json
npm exec nx show project @org/messenger --json
npm exec nx show project @org/features-auth --json
npm exec nx show project @org/entities-user --json
npm exec nx show project @org/shared --json
npm exec nx show project @org/core --json
```

Expected: each command exits with code `0`.

- [ ] **Step 4: Record target availability**

Fill `Nx Project Targets Reviewed` with exact target names from command output. At minimum record whether each project has `test`, `lint`, `typecheck`, and `build`.

Expected: report identifies projects with no direct test target, such as frontend feature packages if absent.

- [ ] **Step 5: Commit the source map**

Run:

```bash
git add docs/audits/2026-07-11-auth-system-diagnostic-audit.md
git commit -m "docs: map auth audit sources and targets"
```

Expected: commit succeeds.

---

### Task 3: Audit Backend Auth Implementation

**Files:**
- Modify: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`
- Read: `libs/backend/auth/src/controllers/auth.controller.ts`
- Read: `libs/backend/auth/src/services/auth.service.ts`
- Read: `libs/backend/auth/src/services/verification.service.ts`
- Read: `libs/backend/auth/src/services/cleanup.service.ts`
- Read: `libs/backend/auth/src/database/repository/auth.prisma.repo.ts`
- Read: `libs/backend/auth/src/cache/auth.redis.repo.ts`
- Read: `libs/backend/auth/src/cache/session.redis.repo.ts`
- Read: `libs/backend/auth/src/cache/ban.redis.repo.ts`
- Read: `libs/backend/auth/src/dto/*.ts`
- Read: `libs/backend/auth/src/strategies/*.ts`
- Read: `libs/backend/auth/src/guards/*.ts`
- Read: `libs/backend/auth/src/services/auth.service.spec.ts`
- Read: `libs/backend/auth/src/controllers/auth.controller.spec.ts`
- Read: `libs/backend/auth/src/database/repository/auth.prisma.repo.spec.ts`
- Read: `libs/backend/auth/src/cache/session.redis.repo.spec.ts`
- Read: `libs/backend/auth/src/cache/ban.redis.repo.spec.ts`

**Interfaces:**
- Consumes: source map from Task 2
- Produces: backend auth rows in `Spec-To-Code Matrix` and `Backend Auth Findings`

- [ ] **Step 1: Search backend auth code and tests**

Run:

```bash
rg -n "register|validateCredentials|login|logout|refresh|verifyEmail|resend|forgot|reset|session|revoke|ban|OAuth|oauth|emit|ZodValidation|Logger|password|token|cookie" libs/backend/auth/src
```

Expected: command exits with code `0` and identifies implementation and tests for auth flows.

- [ ] **Step 2: Inspect implementation files**

Run:

```bash
sed -n '1,560p' libs/backend/auth/src/services/auth.service.ts
sed -n '1,220p' libs/backend/auth/src/controllers/auth.controller.ts
sed -n '1,180p' libs/backend/auth/src/services/verification.service.ts
sed -n '1,260p' libs/backend/auth/src/database/repository/auth.prisma.repo.ts
sed -n '1,220p' libs/backend/auth/src/cache/session.redis.repo.ts
sed -n '1,220p' libs/backend/auth/src/cache/ban.redis.repo.ts
```

Expected: commands exit with code `0`.

- [ ] **Step 3: Inspect backend auth tests**

Run:

```bash
sed -n '1,460p' libs/backend/auth/src/services/auth.service.spec.ts
sed -n '1,140p' libs/backend/auth/src/controllers/auth.controller.spec.ts
sed -n '1,180p' libs/backend/auth/src/database/repository/auth.prisma.repo.spec.ts
sed -n '1,180p' libs/backend/auth/src/cache/session.redis.repo.spec.ts
sed -n '1,180p' libs/backend/auth/src/cache/ban.redis.repo.spec.ts
```

Expected: commands exit with code `0`.

- [ ] **Step 4: Classify backend auth spec items**

Update `Spec-To-Code Matrix` and `Backend Auth Findings` with one row per checked item. Each row must contain concrete implementation evidence, an existing test path or `none`, one classification from the legend, and a concrete follow-up action or `No action`.

Check these backend auth items:

- Registration creates credentials, emits profile/search events, and sends verification email.
- Login validates credentials, email verification, rate limiting, and ban state.
- Refresh rotates token pair and detects replay or revoked sessions.
- Logout revokes SQL session and Redis active session.
- Session listing, one-session revoke, and revoke-all match the spec.
- Forgot/reset password hides account enumeration and revokes sessions when required.
- OAuth creates or links accounts for GitHub, Google, and Yandex.
- Login ban and admin ban semantics are documented and tested.
- Zod DTOs are based on shared contracts and validation behavior is safe.
- Logs do not expose raw password, token, reset token, OAuth code, or unsafe payloads in demo/prod.

- [ ] **Step 5: Commit backend auth audit**

Run:

```bash
git add docs/audits/2026-07-11-auth-system-diagnostic-audit.md
git commit -m "docs: audit backend auth behavior"
```

Expected: commit succeeds.

---

### Task 4: Audit Gateway Auth, Cookies, WebSocket, And Swagger

**Files:**
- Modify: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`
- Read: `apps/backend/gateway/src/controllers/auth.controller.ts`
- Read: `apps/backend/gateway/src/controllers/frontend-error.controller.ts`
- Read: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- Read: `apps/backend/gateway/src/main.ts`
- Read: `apps/backend/gateway/src/app/gateway.module.ts`
- Read: `apps/backend/gateway/src/controllers/*.spec.ts`
- Read: `apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts`

**Interfaces:**
- Consumes: backend audit rows from Task 3
- Produces: gateway rows in `Spec-To-Code Matrix`, `Gateway Findings`, and `Swagger Drift`

- [ ] **Step 1: Search gateway auth and docs surface**

Run:

```bash
rg -n "Controller\\('auth|Post\\(|Get\\(|Delete\\(|ApiOperation|ApiResponse|ApiCookieAuth|cookie|clearCookie|refresh_token|access_token|ZodValidationPipe|Logger|send\\(|catchError|Unauthorized|SwaggerModule|DocumentBuilder" apps/backend/gateway/src
```

Expected: command exits with code `0`.

- [ ] **Step 2: Inspect gateway files**

Run:

```bash
sed -n '1,520p' apps/backend/gateway/src/controllers/auth.controller.ts
sed -n '1,140p' apps/backend/gateway/src/controllers/frontend-error.controller.ts
sed -n '1,340p' apps/backend/gateway/src/gateways/chat.socket-gateway.ts
sed -n '1,120p' apps/backend/gateway/src/main.ts
sed -n '1,180p' apps/backend/gateway/src/app/gateway.module.ts
```

Expected: commands exit with code `0`.

- [ ] **Step 3: Inspect gateway tests**

Run:

```bash
sed -n '1,460p' apps/backend/gateway/src/controllers/admin.controller.spec.ts
sed -n '1,120p' apps/backend/gateway/src/controllers/frontend-error.controller.spec.ts
sed -n '1,220p' apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts
```

Expected: commands exit with code `0`. If `auth.controller` has no direct spec, record that as a test gap.

- [ ] **Step 4: Classify gateway spec items**

Update `Spec-To-Code Matrix` and `Gateway Findings` with one row per checked item. Each row must contain concrete implementation evidence, an existing test path or `none`, one classification from the legend, and a concrete follow-up action or `No action`.

Check these gateway items:

- Auth HTTP endpoints route through gateway and use DTO/Zod validation.
- HttpOnly cookies are set and cleared with environment-appropriate options.
- Refresh endpoint reads `refresh_token`, rotates cookies, and handles a missing token safely.
- Logout and session revoke call auth microservice and clear cookies correctly.
- RPC errors map to correct HTTP responses and normalized body.
- OAuth redirects and callbacks do not log or expose unsafe query data.
- WebSocket authenticates via access cookie and enforces ban/active state.
- Frontend error intake validates payload and logs sanitized event.
- Swagger docs match observed endpoint status codes, cookies, and response shapes.

- [ ] **Step 5: Populate Swagger drift table**

For every mismatch found between decorators and observed controller behavior, add a row to `Swagger Drift`:

Expected: `Swagger Drift` has rows for checked auth endpoints. Each row must include the endpoint or schema, observed behavior from code/tests, documented Swagger behavior, one classification from the legend, and the exact documentation correction or `No action`.

- [ ] **Step 6: Commit gateway audit**

Run:

```bash
git add docs/audits/2026-07-11-auth-system-diagnostic-audit.md
git commit -m "docs: audit gateway auth surface"
```

Expected: commit succeeds.

---

### Task 5: Audit Frontend Auth Behavior, Visual Risks, And UX

**Files:**
- Modify: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`
- Read: `apps/client/messenger/src/**`
- Read: `libs/client/features/auth/src/model/*.ts`
- Read: `libs/client/features/auth/src/ui/*.tsx`
- Read: `libs/client/pages/auth/**/src/lib/*.tsx`
- Read: `libs/client/entities/user/src/model/session.store.ts`
- Read: `libs/client/entities/user/src/ui/auth-provider.tsx`
- Read: `libs/client/entities/user/src/api/user.api.ts`
- Read: `libs/client/shared/src/lib/api/authed-fetch.ts`
- Read: `libs/client/shared/src/lib/hooks/use-logger.ts`
- Read: `libs/client/shared/src/ui/**/*.tsx` as needed for visual components used by auth forms

**Interfaces:**
- Consumes: frontend scope from approved design
- Produces: frontend rows in `Spec-To-Code Matrix`, `Frontend Auth And UX Findings`, `Visual Review`, and `Recommended Test Additions`

- [ ] **Step 1: Search frontend auth code**

Run:

```bash
rg -n "LoginForm|RegisterForm|ForgotPasswordForm|ResetPasswordForm|OAuthButtons|useLogin|useRegister|useLogout|useSessions|useSessionStore|AuthProvider|authedFetch|refresh|Protected|Navigate|CLIENT_ROUTES|toast|useLogger|reportFrontendError" apps/client/messenger/src libs/client/features/auth/src libs/client/pages/auth libs/client/entities/user/src libs/client/shared/src
```

Expected: command exits with code `0`.

- [ ] **Step 2: Inspect frontend auth files**

Run:

```bash
sed -n '1,140p' libs/client/features/auth/src/ui/login-form.tsx
sed -n '1,140p' libs/client/features/auth/src/ui/register-form.tsx
sed -n '1,140p' libs/client/features/auth/src/ui/forgot-password-form.tsx
sed -n '1,140p' libs/client/features/auth/src/ui/reset-password-form.tsx
sed -n '1,120p' libs/client/features/auth/src/ui/oauth-buttons.tsx
sed -n '1,120p' libs/client/features/auth/src/ui/check-email-screen.tsx
sed -n '1,120p' libs/client/features/auth/src/ui/email-verified-screen.tsx
sed -n '1,120p' libs/client/features/auth/src/model/use-login.ts
sed -n '1,120p' libs/client/features/auth/src/model/use-register.ts
sed -n '1,140p' libs/client/features/auth/src/model/use-sessions.ts
sed -n '1,120p' libs/client/entities/user/src/model/session.store.ts
sed -n '1,160p' libs/client/entities/user/src/ui/auth-provider.tsx
sed -n '1,120p' libs/client/shared/src/lib/api/authed-fetch.ts
```

Expected: commands exit with code `0`.

- [ ] **Step 3: Inspect auth pages and app routing**

Run:

```bash
rg -n "auth|login|register|forgot|reset|check-email|email-verified|Protected|Route|createBrowserRouter|RouterProvider" apps/client/messenger/src libs/client/pages/auth libs/client/pages/messenger libs/client/layouts
```

Expected: command exits with code `0`. Read the routed files identified by the search.

- [ ] **Step 4: Classify frontend behavior**

Update `Spec-To-Code Matrix` and `Frontend Auth And UX Findings` with one row per checked item. Each row must contain concrete implementation evidence, an existing test path or `none`, one classification from the legend, and a concrete follow-up action or `No action`.

Check these frontend items:

- Login form validates shared schema, submits, handles loading, errors, and redirect.
- Register form validates username/email/password/confirm and handles duplicate email.
- Forgot/reset password flows avoid token leakage and show clear states.
- Email verified/check email pages match spec redirects and messages.
- OAuth buttons route through gateway API base and preserve cookie-based auth model.
- Session bootstrap, protected routes, logout, and `authedFetch` refresh behave as expected.
- Frontend logging is hidden in demo/prod and does not leak unsafe payloads.

- [ ] **Step 5: Perform static visual risk review**

Inspect auth forms/pages for:

- missing disabled state,
- missing loading indicator,
- content overflow risk,
- long validation text overflow,
- mobile layout risk,
- inaccessible labels or focus states,
- hidden server errors,
- confusing success/error copy.

Add one `Visual Review` row for login, register, forgot password, reset password, check email, email verified, and OAuth buttons. Each row must include viewport/source context, a concrete observation based on layout/classes/component structure, one classification from the legend, and a concrete follow-up action or `No action`.

- [ ] **Step 6: Record frontend test gaps**

Add rows to `Recommended Test Additions` for missing frontend tests:

```markdown
| Component | `@org/features-auth` or auth page package | Form validation and server error rendering | Render form, submit invalid/valid data, assert disabled/loading/error state |
| Integration | `@org/messenger` | Session bootstrap and protected route redirect | Mock `/api/users/me`, refresh behavior, and navigation |
| Visual | auth pages | Desktop/mobile visual regression | Capture login/register/reset/check-email routes at mobile and desktop widths |
```

Use actual project names and test gaps discovered in the target map.

- [ ] **Step 7: Commit frontend audit**

Run:

```bash
git add docs/audits/2026-07-11-auth-system-diagnostic-audit.md
git commit -m "docs: audit frontend auth behavior"
```

Expected: commit succeeds.

---

### Task 6: Audit Observability, Logging, And Redaction

**Files:**
- Modify: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`
- Read: `libs/backend/core/src/observability/logger.ts`
- Read: `libs/backend/core/src/observability/logger.spec.ts`
- Read: `libs/backend/core/src/observability/health.controller.ts`
- Read: `libs/backend/core/src/observability/metrics.controller.ts`
- Read: `libs/backend/core/src/observability/metrics.service.ts`
- Read: `libs/backend/core/src/observability/metrics.interceptor.ts`
- Read: `libs/backend/core/src/observability/telemetry.ts`
- Read: `libs/backend/core/src/observability/telemetry.spec.ts`
- Read: `libs/client/shared/src/lib/observability/frontend-error-reporter.ts`
- Read: `libs/client/shared/src/lib/observability/frontend-error-reporter.spec.ts`
- Read: `libs/client/shared/src/lib/hooks/use-logger.ts`
- Read: `infra/observability/**`

**Interfaces:**
- Consumes: demo=production logging constraint
- Produces: `Observability And Logging Findings` and recommended logging follow-up rows

- [ ] **Step 1: Inspect observability code**

Run:

```bash
sed -n '1,220p' libs/backend/core/src/observability/logger.ts
sed -n '1,180p' libs/backend/core/src/observability/logger.spec.ts
sed -n '1,120p' libs/backend/core/src/observability/health.controller.ts
sed -n '1,140p' libs/backend/core/src/observability/metrics.controller.ts
sed -n '1,160p' libs/backend/core/src/observability/metrics.service.ts
sed -n '1,140p' libs/backend/core/src/observability/metrics.interceptor.ts
sed -n '1,180p' libs/backend/core/src/observability/telemetry.ts
sed -n '1,140p' libs/client/shared/src/lib/observability/frontend-error-reporter.ts
sed -n '1,120p' libs/client/shared/src/lib/hooks/use-logger.ts
```

Expected: commands exit with code `0`.

- [ ] **Step 2: Inspect observability infrastructure**

Run:

```bash
sed -n '1,220p' infra/observability/prometheus/prometheus.yml
sed -n '1,220p' infra/observability/prometheus/rules/polygon-alerts.yml
sed -n '1,220p' infra/observability/alloy/config.alloy
sed -n '1,180p' infra/observability/loki/loki.yml
sed -n '1,180p' infra/observability/tempo/tempo.yml
sed -n '1,180p' infra/observability/grafana/provisioning/datasources/datasources.yml
```

Expected: commands exit with code `0`.

- [ ] **Step 3: Search unsafe logging**

Run:

```bash
rg -n "logger\\.(debug|verbose|log|warn|error)|console\\.(log|debug|error|warn)|useLogger|password|token|refreshToken|accessToken|cookie|authorization|email|dto|payload|req\\.body|req\\.headers|query" apps/backend/gateway/src libs/backend/auth/src apps/backend/auth-service/src libs/client/features/auth/src libs/client/pages/auth libs/client/entities/user/src libs/client/shared/src
```

Expected: command exits with code `0`.

- [ ] **Step 4: Classify observability and logging items**

Update `Observability And Logging Findings` with one row per checked item. Each row must contain concrete implementation/config evidence, one classification from the legend, and a concrete follow-up action or `No action`.

Check these observability items:

- Structured backend logging redacts passwords, tokens, cookies, auth headers, and query strings.
- Auth/gateway debug/verbose logs respect demo=production safety.
- Zod validation errors are visible enough for production diagnosis without raw unsafe payloads.
- Browser errors post sanitized route only, without query/hash.
- `useLogger` or equivalent avoids visible logs in demo/prod.
- Health, readiness, and metrics endpoints match observability docs.
- OTEL enablement and exporter config match docs.
- Prometheus, Grafana, Loki, Tempo, and Alloy config match the documented stack.

- [ ] **Step 5: Record logging improvement candidates**

Add rows to `Prioritized Follow-Up Work` for logging improvements only when evidence shows an actual diagnostic gap, unsafe data risk, or missing event. Include suggested level:

```markdown
| P1 | Redact or remove unsafe auth debug payload in demo/prod | Prevent user data/token exposure | Unit test logger redaction plus integration log assertion |
| P2 | Add structured auth event for refresh replay detection without token values | Improve production diagnosis | Backend unit/integration test |
```

Do not add speculative logging work without a concrete evidence row.

- [ ] **Step 6: Commit observability audit**

Run:

```bash
git add docs/audits/2026-07-11-auth-system-diagnostic-audit.md
git commit -m "docs: audit auth observability and logging"
```

Expected: commit succeeds.

---

### Task 7: Run Automated Verification Commands

**Files:**
- Modify: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`

**Interfaces:**
- Consumes: target map from Task 2
- Produces: `Automated Verification Results` and new findings for failures

- [ ] **Step 1: Run backend and observability tests**

Run:

```bash
npm exec nx test @org/auth
npm exec nx test @org/gateway
npm exec nx test @org/shared
npm exec nx test @org/core
```

Expected: each command either exits with code `0`, or the failure is recorded with the failing suite/test name and first actionable error.

- [ ] **Step 2: Run frontend app tests when available**

Run:

```bash
npm exec nx test @org/messenger
```

Expected: command exits with code `0`, or the failure is recorded. If auth feature/page packages have no test target, record the absence in `Recommended Test Additions`.

- [ ] **Step 3: Run lint checks**

Run:

```bash
npm exec nx lint @org/auth
npm exec nx lint @org/gateway
npm exec nx lint @org/messenger
npm exec nx lint @org/features-auth
npm exec nx lint @org/entities-user
npm exec nx lint @org/shared
npm exec nx lint @org/core
```

Expected: each command either exits with code `0`, or the failure is recorded with project, rule, file, and first actionable error.

- [ ] **Step 4: Run typechecks**

Run:

```bash
npm exec nx typecheck @org/auth
npm exec nx typecheck @org/auth-service
npm exec nx typecheck @org/gateway
npm exec nx typecheck @org/messenger
npm exec nx typecheck @org/features-auth
npm exec nx typecheck @org/entities-user
npm exec nx typecheck @org/shared
npm exec nx typecheck @org/core
```

Expected: each command either exits with code `0`, or the failure is recorded with project, file, and first actionable TypeScript error.

- [ ] **Step 5: Run production builds for deployable surfaces**

Run:

```bash
npm exec nx build @org/auth-service
npm exec nx build @org/gateway
npm exec nx build @org/messenger
```

Expected: each command either exits with code `0`, or the failure is recorded with project and first actionable error.

- [ ] **Step 6: Record results**

Add one row per command to `Automated Verification Results`:

```markdown
| `npm exec nx test @org/auth` | pass/fail | Summary of suites or first actionable failure |
```

For each failure that indicates an auth/frontend/observability problem, add a corresponding row to the relevant findings table and `Prioritized Follow-Up Work`.

- [ ] **Step 7: Commit automated verification results**

Run:

```bash
git add docs/audits/2026-07-11-auth-system-diagnostic-audit.md
git commit -m "docs: record auth audit verification results"
```

Expected: commit succeeds.

---

### Task 8: Define Manual And Visual Validation Checklist

**Files:**
- Modify: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`

**Interfaces:**
- Consumes: findings from Tasks 3-7
- Produces: concrete manual validation checklist and user-help points

- [ ] **Step 1: Add manual validation rows**

Populate `Manual Validation Points` with these rows, adjusting status based on evidence:

```markdown
| Real verification email | Requires SMTP/mailbox and link click | User confirms email receipt and link behavior | needs-manual-validation |
| Real reset password email | Requires SMTP/mailbox and token link click | User confirms email receipt and reset result | needs-manual-validation |
| OAuth GitHub callback | Requires provider credentials and browser redirect | User confirms provider account and callback result | needs-manual-validation |
| OAuth Google callback | Requires provider credentials and browser redirect | User confirms provider account and callback result | needs-manual-validation |
| OAuth Yandex callback | Requires provider credentials and browser redirect | User confirms provider account and callback result | needs-manual-validation |
| Browser cookie behavior | Requires browser with gateway/client running | User validates HttpOnly cookies, refresh, logout clearing | needs-manual-validation |
| Docker observability stack | Requires Docker monitoring stack running | User validates Grafana, Loki logs, Prometheus targets, Tempo traces | needs-manual-validation |
| Mobile auth visual behavior | Requires browser screenshots or Playwright/browser run | User validates no overlap/overflow on mobile widths | needs-manual-validation |
```

Expected: every manual row includes why automation is insufficient.

- [ ] **Step 2: Add visual validation acceptance checks**

Add to `Visual Review` rows for dynamic checks that must eventually be run:

```markdown
| 390x844 | `/auth/login` | Needs browser validation for form spacing, disabled state, error text, OAuth buttons | needs-manual-validation | Run visual check after app boots |
| 390x844 | `/auth/register` | Needs browser validation for long validation messages and form height | needs-manual-validation | Run visual check after app boots |
| 1440x900 | `/auth/login` | Needs browser validation for desktop centering and no oversized typography inside form | needs-manual-validation | Run visual check after app boots |
| 1440x900 | `/auth/reset-password?token=demo` | Needs browser validation that token is not rendered/logged and invalid state is clear | needs-manual-validation | Run visual check after app boots |
```

Expected: visual rows distinguish static code review from future browser validation.

- [ ] **Step 3: Commit manual and visual checklist**

Run:

```bash
git add docs/audits/2026-07-11-auth-system-diagnostic-audit.md
git commit -m "docs: add auth audit manual validation checklist"
```

Expected: commit succeeds.

---

### Task 9: Finalize Findings, Decisions, And Follow-Up Priorities

**Files:**
- Modify: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`

**Interfaces:**
- Consumes: all prior findings
- Produces: completed audit report ready for user review and next implementation plan

- [ ] **Step 1: Normalize status values**

Run:

```bash
rg -n "TBD|TODO|unknown|\\| \\| \\|" docs/audits/2026-07-11-auth-system-diagnostic-audit.md
```

Expected: any empty table cell that should contain evidence or unresolved marker is replaced with a real classification or concise note.

- [ ] **Step 2: Populate `Decisions Needed`**

For each ambiguous behavior, add a row:

```markdown
| Whether login should reveal `User not found` vs generic invalid credentials | Spec currently lists distinct messages, but security may prefer generic auth failure | Distinct messages / generic message | Choose generic in production unless product requires explicit messages |
```

Only add decisions supported by evidence from earlier sections.

- [ ] **Step 3: Populate `Prioritized Follow-Up Work`**

Use priorities:

- `P0`: security leak, auth bypass, production-blocking build/test failure.
- `P1`: spec-critical auth behavior broken or untested.
- `P2`: UX or observability gap that affects diagnosis or user clarity.
- `P3`: documentation/Swagger drift or polish.

Each row must include a suggested test level.

- [ ] **Step 4: Update summary**

Replace `Status: in progress` with:

```markdown
Status: ready for review

High-level result:
- Backend auth: one-sentence summary based on findings.
- Gateway: one-sentence summary based on findings.
- Frontend auth/UX: one-sentence summary based on findings.
- Observability/logging: one-sentence summary based on findings.
- Automated verification: one-sentence summary based on command results.
- Manual validation: one-sentence summary of what still needs user/browser/provider validation.
```

Expected: summary reflects actual findings and does not claim unchecked behavior is complete.

- [ ] **Step 5: Commit final audit report**

Run:

```bash
git add docs/audits/2026-07-11-auth-system-diagnostic-audit.md
git commit -m "docs: finalize auth diagnostic audit"
```

Expected: commit succeeds.

---

## Plan Self-Review Checklist

Before executing this plan, verify:

- The report path is exact: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`.
- Every approved audit area has at least one task.
- Demo is treated as production-like in the observability task.
- Frontend component behavior, visual risk, and UX are first-class tasks.
- Swagger drift is checked after gateway behavior is inspected.
- No task instructs the implementer to fix production code.
- Each task has an independently committable report update.
