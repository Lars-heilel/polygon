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
