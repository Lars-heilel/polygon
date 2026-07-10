# Docker Demo Prisma Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `docker/demo` start with a Prisma client and migration set that match the checked-in schemas, without destructive database operations.

**Architecture:** Regenerate Prisma clients only after the full repo is copied into the Docker builder so the image cannot ship stale generated artifacts. Fail fast in `start.sh` when a migration directory exists without its `migration.sql`, instead of partially applying migrations and starting broken services.

**Tech Stack:** Docker multi-stage builds, shell startup script, Prisma CLI, Nx targets

---

### Task 1: Fix docker/demo build and startup guards

**Files:**
- Modify: `docker/demo/Dockerfile`
- Modify: `docker/demo/start.sh`

- [ ] Move Prisma generation to run after `COPY . .` so repo contents cannot overwrite newly generated clients.
- [ ] Keep runtime copy paths unchanged, but ensure they now point at freshly generated outputs from the builder stage.
- [ ] Add startup validation that detects migration directories missing `migration.sql` and exits with a clear error before `migrate deploy`.

### Task 2: Re-sync checked-in generated Prisma clients

**Files:**
- Modify: `libs/backend/user/src/database/generated/**`
- Modify: `libs/backend/chat/src/database/generated/**`

- [ ] Regenerate `@org/user` and `@org/chat` Prisma clients from the current checked-in schemas.
- [ ] Confirm generated inline schemas no longer reference `BlockedUser`, `unreadCount`, `lastReadAt`, `editedAt`, `deletedAt`, or other fields absent from current `schema.prisma`.

### Task 3: Verify the safe fix

**Files:**
- Verify only

- [ ] Run `npm exec nx run @org/user:prisma-generate` and `npm exec nx run @org/chat:prisma-generate`.
- [ ] Run a focused check that the generated client inline schemas match current source schemas.
- [ ] Run a Dockerfile/startup-script sanity check by inspecting the resulting diff and command outputs; do not run destructive Prisma commands.
