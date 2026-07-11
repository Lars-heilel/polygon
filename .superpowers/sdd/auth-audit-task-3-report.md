# Auth Audit Task 3 Report

## Status

Completed backend-auth audit revision only. No production code was changed and no broad test suite was run.

## Commit

- Initial commit: `b43a3a8 docs: audit backend auth behavior`
- Revision commit: `0f6b88d docs: revise backend auth audit`
- Logging-audit fix commit: pending
- Committed file: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`

## Audit Output

The audit document now includes the repository-boundary row, revised password-reset and administrator-ban classifications, mirrored manual-validation points, captured excerpts for Task 3 command evidence, and a static slow-query sensitive-logging defect.

Classifications recorded:

- `bug`: rate limiter blocks the sixth failed attempt rather than the documented fifth; replay revocation does not clear Redis active-session keys; revoke-all revokes the current session; reset revokes the current authenticated session and does not clear login attempts; RMQ DTO validation applies only to registration; non-production slow-query logging emits raw serialized Prisma parameters.
- `implemented`: logout revokes the SQL session and Redis active-session entries.
- `implemented`: `AuthPrismaRepository` is bound through the auth repository token, and the auth Prisma client owns `AUTH_DATABASE_URL`.
- `implemented-no-test`: registration side effects are implemented but have no direct coverage.
- `missing-from-spec`: administrator-ban lifecycle, authorization, cache/session revocation, and expiry normalization exist in code and tests but remain undocumented.
- `needs-manual-validation`: OAuth linking needs User-service/provider integration proof, and the remaining handler-log redaction needs runtime log-capture proof in JSON and pretty modes.

## Verification

- Required backend search and all listed implementation/test reads completed with exit code `0`.
- Remaining required reads for cleanup, Auth Redis cache, DTOs, strategies, and guards completed with exit code `0`.
- `git diff --check` exited `0` before commit.
- `git diff --cached --check` exited `0` before commit.
- Initial audit commit changed one file with 33 insertions; revision `0f6b88d` changed one audit-document file with 22 insertions and 17 deletions.
- No test command was run because the brief required test inspection, not execution, and prohibited broad suites absent an explicit requirement.

## Concerns

- The documented fifth-attempt rate-limit behavior conflicts with the `attempts > 5` implementation.
- A detected refresh-token replay revokes SQL rows without deleting Redis session keys; `SessionGuard` uses those keys for instant revocation.
- The user-facing "all other sessions" requirement conflicts with a revoke-all API that has no current-session input.
- Password reset also delegates to that revoke-all API, violating the documented requirement to retain the current authenticated session when applicable.
- Non-production slow-query logging emits raw serialized Prisma parameters; omit or redact them outside explicitly safe local development and add coverage.
- Handler-log output in JSON and pretty modes remains a separate runtime validation point.

## Task 3 Fix Note

- Verified the uncommitted audit diff records Prisma slow-query raw `params` logging as a static `bug` in both the Spec-To-Code Matrix and Backend Auth Findings, with follow-up to omit or redact query parameters outside explicitly safe local development and add coverage.
- Runtime verification of emitted JSON and pretty logs remains a separate manual validation point.

## Paths

- Audit: `docs/audits/2026-07-11-auth-system-diagnostic-audit.md`
- Handoff: `.superpowers/sdd/auth-audit-task-3-report.md`
