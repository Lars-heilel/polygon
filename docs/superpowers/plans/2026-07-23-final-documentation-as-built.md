# Final As-Built Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Polygon documentation as English final-state as-built documentation while preserving the old engineering docs under `docs/oldDocs/`.

**Architecture:** Treat README and `docs/specs/*.md` as product contract documentation, and treat architecture/development/gotchas/observability/setup docs as engineering reference documentation. Create immutable old-doc copies before editing engineering references, then rewrite active docs against current code, tests, and recent commits. Validate through text searches, link/path checks, Nx docs-related smoke checks where applicable, and a final isolated documentation commit.

**Tech Stack:** Markdown, Nx monorepo, React/Vite client, NestJS microservices, RabbitMQ, PostgreSQL, Redis, MinIO, Meilisearch, Socket.IO.

## Global Constraints

- Do not change application code.
- Communicate with the user in Russian; write repository documentation in English.
- Do not document future roadmap items as product behavior.
- Do not restore or stage the pre-existing deleted `docs/superpowers/...` files unless the user explicitly asks.
- Preserve the engineering baseline in `docs/oldDocs/` before editing `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/MONOREPO_GOTCHAS.md`, `docs/OBSERVABILITY.md`, or `docs/SETUP.md`.
- Product specs must describe implemented behavior only.
- Engineering docs must preserve operational rules, gotchas, commands, architecture constraints, and observability contracts.

---

## File Structure

**Create:**

- `docs/oldDocs/ARCHITECTURE.md` — backup of the current Russian architecture reference.
- `docs/oldDocs/DEVELOPMENT.md` — backup of the current Russian development reference.
- `docs/oldDocs/MONOREPO_GOTCHAS.md` — backup of the current Russian monorepo gotchas reference.
- `docs/oldDocs/OBSERVABILITY.md` — backup of the current Russian observability reference.
- `docs/oldDocs/SETUP.md` — backup of the current Russian setup reference.

**Modify:**

- `README.md` — final English project entry point, feature summary, documentation map, setup, verification commands.
- `docs/specs/SPEC.md` — final English system overview and as-built feature matrix.
- `docs/specs/auth-service.md` — final English auth/session/OAuth requirements.
- `docs/specs/user-service.md` — final English profile/avatar/user requirements.
- `docs/specs/chat-service.md` — final English chat/message/attachment/forwarding requirements.
- `docs/specs/media-service.md` — final English media upload/storage/rendering requirements.
- `docs/specs/notification-service.md` — final English notification requirements for implemented email/push behavior.
- `docs/specs/search-service.md` — final English search requirements for implemented user/message indexing/search behavior.
- `docs/specs/gateway-service.md` — final English gateway HTTP/WebSocket/session-guard requirements.
- `docs/specs/infrastructure.md` — final English infrastructure/runtime requirements.
- `docs/specs/client-messenger.md` — final English client as-built UX requirements.
- `docs/ARCHITECTURE.md` — English engineering architecture reference with current session guard and Socket.IO behavior.
- `docs/DEVELOPMENT.md` — English development reference preserving Nx, boundaries, conventions, and observability rules.
- `docs/MONOREPO_GOTCHAS.md` — English gotchas reference preserving Tailwind, Vite proxy, env, Prisma, MSW, Gateway test notes.
- `docs/OBSERVABILITY.md` — English observability reference preserving safe logging and diagnostic contracts.
- `docs/SETUP.md` — English setup reference preserving actual bootstrap and runtime commands.

**Leave unchanged unless link text requires English updates:**

- `docs/screenshots/*`

---

### Task 1: Preserve Engineering Documentation Baseline

**Files:**
- Create: `docs/oldDocs/ARCHITECTURE.md`
- Create: `docs/oldDocs/DEVELOPMENT.md`
- Create: `docs/oldDocs/MONOREPO_GOTCHAS.md`
- Create: `docs/oldDocs/OBSERVABILITY.md`
- Create: `docs/oldDocs/SETUP.md`

**Interfaces:**
- Consumes: current engineering docs in `docs/*.md`.
- Produces: old-doc backups that validation checks may exempt from English-only rules.

- [ ] **Step 1: Create the backup directory**

Run:

```bash
mkdir -p docs/oldDocs
```

Expected: command exits with status 0.

- [ ] **Step 2: Copy the engineering docs into `docs/oldDocs/`**

Run:

```bash
cp docs/ARCHITECTURE.md docs/oldDocs/ARCHITECTURE.md
cp docs/DEVELOPMENT.md docs/oldDocs/DEVELOPMENT.md
cp docs/MONOREPO_GOTCHAS.md docs/oldDocs/MONOREPO_GOTCHAS.md
cp docs/OBSERVABILITY.md docs/oldDocs/OBSERVABILITY.md
cp docs/SETUP.md docs/oldDocs/SETUP.md
```

Expected: each copied file exists.

- [ ] **Step 3: Verify backup files exist and are non-empty**

Run:

```bash
test -s docs/oldDocs/ARCHITECTURE.md
test -s docs/oldDocs/DEVELOPMENT.md
test -s docs/oldDocs/MONOREPO_GOTCHAS.md
test -s docs/oldDocs/OBSERVABILITY.md
test -s docs/oldDocs/SETUP.md
```

Expected: all commands exit with status 0.

- [ ] **Step 4: Verify backups match the current source docs before edits**

Run:

```bash
cmp docs/ARCHITECTURE.md docs/oldDocs/ARCHITECTURE.md
cmp docs/DEVELOPMENT.md docs/oldDocs/DEVELOPMENT.md
cmp docs/MONOREPO_GOTCHAS.md docs/oldDocs/MONOREPO_GOTCHAS.md
cmp docs/OBSERVABILITY.md docs/oldDocs/OBSERVABILITY.md
cmp docs/SETUP.md docs/oldDocs/SETUP.md
```

Expected: all commands exit with status 0 and print no differences.

---

### Task 2: Audit Implemented Behavior for the As-Built Matrix

**Files:**
- Read: `README.md`
- Read: `docs/specs/*.md`
- Read: `apps/backend/gateway/src/controllers/*.ts`
- Read: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- Read: `libs/backend/auth/src/services/auth.service.ts`
- Read: `libs/backend/chat/src/services/chat.service.ts`
- Read: `libs/backend/media/src/services/media.service.ts`
- Read: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/**`
- Read: `libs/client/entities/message/src/ui/**`
- Read: `apps/client/messenger/src/app/*.spec.ts*`
- Read: `apps/client/messenger/e2e/*.spec.ts`

**Interfaces:**
- Consumes: current source code and tests.
- Produces: a temporary working checklist of implemented features used to rewrite docs. Do not commit the temporary checklist unless it is folded into docs.

- [ ] **Step 1: Inspect recent commits that define final behavior**

Run:

```bash
git log --oneline -12
```

Expected: output includes `fix(gateway): enforce revoked sessions on private routes` and `fix(messenger): repair media message interactions`.

- [ ] **Step 2: Inventory current specs and e2e coverage**

Run:

```bash
rg --files apps libs | rg '(\.spec\.ts|\.spec\.tsx|e2e/.+\.spec\.ts)$'
```

Expected: output lists backend controller/service specs, messenger app specs, and messenger e2e specs.

- [ ] **Step 3: Inventory implemented gateway routes and guards**

Run:

```bash
rg "@Controller|@UseGuards|@Get|@Post|@Patch|@Delete|SessionGuard|JwtGuard" apps/backend/gateway/src/controllers -n
```

Expected: production controllers use `SessionGuard` for private routes; auth session routes also use `SessionGuard`.

- [ ] **Step 4: Inventory client message/media features**

Run:

```bash
rg "forward|edit|delete|linkPreview|Voice|Circle|Audio|Video|Attachment|unread|avatar|theme|session" libs/client apps/client/messenger/src/app -n
```

Expected: output confirms implemented message actions, forwarded messages, media rendering, unread state, avatar history, themes, and sessions.

- [ ] **Step 5: Mark non-implemented product items for removal from product specs**

Run:

```bash
rg "call|calls|group|PWA|offline|i18n|будущее|В разработке|Надо|planned|todo|in development" README.md docs/specs docs/*.md -n
```

Expected: output identifies roadmap/product drift to remove from README and product specs. Engineering docs may contain maintenance-oriented language that can remain if it is operational and translated.

---

### Task 3: Rewrite README as the Final English Entry Point

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 2 as-built feature matrix.
- Produces: English final project overview and documentation map.

- [ ] **Step 1: Rewrite README title, status, and project description**

Replace development status with final-state wording:

```markdown
# Polygon

_By Lars Heilel (Igor Shevchenko)_

Polygon is a final-state full-stack messenger implementation built as an Nx monorepo. It combines a React messenger SPA, a NestJS API Gateway, service-owned PostgreSQL databases, RabbitMQ messaging, Redis-backed sessions, MinIO media storage, Meilisearch indexing, and Socket.IO real-time delivery.
```

Expected: README no longer says `In Development`.

- [ ] **Step 2: Add a final feature summary**

Include implemented behavior only:

```markdown
## Final Feature Set

- Cookie-based authentication with email/password, GitHub OAuth, Google OAuth, email verification, password reset, refresh-token rotation, and Redis-backed session revocation.
- Direct and saved-message chats with cursor-paginated messages, unread counters, typing indicators, online presence, and Socket.IO updates.
- Text, image, video, audio, voice, circle video, and document messages with MinIO-backed uploads.
- Message actions: edit, delete for everyone, delete for self, copy, and forward with original-author snapshots.
- Link previews, media rendering, compact global audio playback, waveform voice/audio messages, and chat media panels.
- User profile, avatar history, settings, device/session management, dark and light themes.
- Admin account management for user detail, sessions, bans, and related moderation workflows.
```

Expected: README describes current behavior without future promises.

- [ ] **Step 3: Update documentation map and system statuses**

Use final-state labels:

```markdown
## Documentation Map

| Document | Purpose |
| --- | --- |
| [Product Specification](./docs/specs/SPEC.md) | Final as-built product behavior and system map |
| [Architecture](./docs/ARCHITECTURE.md) | Runtime architecture and service responsibilities |
| [Development Guide](./docs/DEVELOPMENT.md) | Nx workflow, conventions, boundaries, and safe maintenance rules |
| [Setup Guide](./docs/SETUP.md) | Local infrastructure, environment, and startup commands |
| [Monorepo Gotchas](./docs/MONOREPO_GOTCHAS.md) | Non-obvious Nx, Vite, Tailwind, Prisma, and testing notes |
| [Observability](./docs/OBSERVABILITY.md) | Logging, diagnostics, and data-safety contracts |
```

Expected: README links resolve to existing files.

- [ ] **Step 4: Add final verification commands**

Use commands already validated in this repository:

Add this Markdown block:

    ## Verification

    ```bash
    npm exec nx test @org/gateway
    npm exec nx test @org/messenger
    npm exec nx build @org/gateway
    npm exec nx build @org/messenger
    ```

Expected: README gives project-level verification entry points.

---

### Task 4: Rewrite Product Specs as As-Built Acceptance Criteria

**Files:**
- Modify: `docs/specs/SPEC.md`
- Modify: `docs/specs/auth-service.md`
- Modify: `docs/specs/user-service.md`
- Modify: `docs/specs/chat-service.md`
- Modify: `docs/specs/media-service.md`
- Modify: `docs/specs/notification-service.md`
- Modify: `docs/specs/search-service.md`
- Modify: `docs/specs/gateway-service.md`
- Modify: `docs/specs/infrastructure.md`
- Modify: `docs/specs/client-messenger.md`

**Interfaces:**
- Consumes: Task 2 audit and final README feature summary.
- Produces: English product contract docs with no roadmap wording.

- [ ] **Step 1: Rewrite `docs/specs/SPEC.md` as final system overview**

Use sections:

```markdown
# Polygon Messenger Product Specification

## Status

Polygon is documented here as a final as-built system. This specification describes implemented behavior only.

## System Map

| System | Final responsibility |
| --- | --- |
| API Gateway | HTTP entry point, session-aware guards, OAuth redirects, Socket.IO gateway, RPC bridge |
| Auth Service | credentials, OAuth login, email verification, password reset, refresh rotation, sessions |
| User Service | public profiles, profile edits, avatar state |
| Chat Service | chats, messages, attachments, reads, edits, deletes, forwards |
| Media Service | upload initialization, confirmation, metadata, content access, thumbnails/waveforms where available |
| Notification Service | email and push subscription/event handling |
| Search Service | user and message indexing/search through Meilisearch |
| Messenger SPA | final React client for auth, chat, media, profile, settings, and admin workflows |
```

Expected: no `В разработке`, `Почти готово`, or status emoji roadmap table remains.

- [ ] **Step 2: Rewrite each service spec around implemented responsibilities**

Use these exact document titles and section names:

```text
docs/specs/auth-service.md: # Auth Service Specification
docs/specs/user-service.md: # User Service Specification
docs/specs/chat-service.md: # Chat Service Specification
docs/specs/media-service.md: # Media Service Specification
docs/specs/notification-service.md: # Notification Service Specification
docs/specs/search-service.md: # Search Service Specification
docs/specs/gateway-service.md: # API Gateway Specification
docs/specs/infrastructure.md: # Infrastructure Specification
docs/specs/client-messenger.md: # Messenger SPA Specification
```

Every spec must use these sections:

```text
## Purpose
## Implemented Capabilities
## Runtime Contracts
## Acceptance Criteria
```

Write at least these acceptance criteria:

```text
AUTH-1: Login creates HttpOnly access and refresh cookies.
AUTH-2: Refresh rotates tokens and rejects revoked refresh-token reuse.
AUTH-3: Revoking a session removes it from Redis and blocks later private requests.
AUTH-4: Device/session listing marks the current session.
USER-1: Current user profile is returned through a valid active session.
USER-2: Public profile data is available for chat/profile display.
USER-3: Avatar state is used by profile and chat header UI without falling back to the current user's avatar.
CHAT-1: Direct and saved-message chats can be created and listed.
CHAT-2: Messages are cursor-paginated and enriched for client rendering.
CHAT-3: Text and attachment messages support optimistic client updates and socket delivery.
CHAT-4: Forwarded messages preserve original author snapshots and original message date.
CHAT-5: Edit, delete for everyone, and delete for self update HTTP cache and socket listeners.
CHAT-6: Read state updates unread counters and active-chat state.
MEDIA-1: Upload initialization returns storage data for confirmed media.
MEDIA-2: Confirmed media is rendered by category: image, video, audio, voice, circle, document.
MEDIA-3: Voice messages hide raw filenames and render a stable waveform layout.
NOTIFICATION-1: Clients join notification rooms for known chats.
NOTIFICATION-2: Incoming messages update last message, unread state, sound/toast behavior, and avoid duplicate message:new listeners.
SEARCH-1: User search returns profiles for chat creation and admin lookup.
SEARCH-2: Message/user indexing follows implemented RabbitMQ events.
GATEWAY-1: Private HTTP routes use SessionGuard and reject missing Redis sessions.
GATEWAY-2: Socket.IO authenticates on connect and handles chat join/leave/message events.
GATEWAY-3: OAuth and auth HTTP routes set and clear cookies through the gateway.
INFRA-1: Docker-backed PostgreSQL, Redis, RabbitMQ, MinIO, and Meilisearch are required runtime dependencies.
INFRA-2: Nx commands are the supported build/test/serve interface.
CLIENT-1: Auth bootstrap redirects unauthenticated users to login.
CLIENT-2: Chat list previews show specific message/media types and unread counters.
CLIENT-3: Chat footer supports text, file upload, voice recording, and mobile circle recording preview.
CLIENT-4: Message actions support edit, delete, copy, and forward.
CLIENT-5: Global compact audio player supports previous and next queue navigation.
CLIENT-6: Profile, avatar history, settings, device management, and dark/light themes are available.
```

Expected: each service spec reads as current behavior, not a future backlog.

- [ ] **Step 3: Remove non-implemented product features from specs**

Delete final-product claims for:

```text
P2P calls
group calls
full group role management if not implemented
offline PWA cache behavior
i18n
future roadmap
planned feature levels
```

Expected: removed items do not appear as implemented behavior.

- [ ] **Step 4: Keep implemented advanced chat/client behavior**

Ensure specs include:

```text
forwarded messages with original-author snapshots
edit and delete message flows
delete for self and delete for everyone
attachments and media categories
voice and circle recording
global compact audio player
link previews
unread counters
session/device management
avatar history
admin session and ban controls
session-aware private gateway routes
```

Expected: current final behavior is fully represented.

---

### Task 5: Translate and Preserve Engineering Reference Docs

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DEVELOPMENT.md`
- Modify: `docs/MONOREPO_GOTCHAS.md`
- Modify: `docs/OBSERVABILITY.md`
- Modify: `docs/SETUP.md`

**Interfaces:**
- Consumes: Task 1 backups and Task 2 audit.
- Produces: English engineering references that preserve operational value.

- [ ] **Step 1: Translate `docs/ARCHITECTURE.md` without removing architecture constraints**

Keep these exact concepts in English:

```text
API Gateway as single entry point
database per service
RabbitMQ service communication
Socket.IO real-time gateway
Redis-backed sessions
SessionGuard on private gateway routes
React Feature-Sliced Design mini-packages
shared schemas in @org/common
```

Expected: architecture remains useful for future maintenance.

- [ ] **Step 2: Translate `docs/DEVELOPMENT.md` without weakening rules**

Preserve:

```text
Nx commands through npm exec nx
module boundary rules
TypeScript strict rules
NestJS repository pattern
observability lifecycle logging contract
no raw sensitive logs
frontend console policy
testing strategy
```

Expected: the guide remains a working contributor reference.

- [ ] **Step 3: Translate `docs/MONOREPO_GOTCHAS.md` preserving exact technical gotchas**

Preserve:

```text
Tailwind v4 @source paths
Vite proxy for /api and /socket.io
root .env behavior
Prisma env path differences
MSW multi-lib notes
Gateway supertest notes
```

Expected: no gotcha is removed unless the code proves it is obsolete.

- [ ] **Step 4: Translate `docs/OBSERVABILITY.md` preserving logging contracts**

Preserve:

```text
safe diagnostic flags
no raw user/token/payload logging
frontendLog/useLogger guidance
production console cleanliness
backend lifecycle event naming
```

Expected: future maintenance still has the same observability standards.

- [ ] **Step 5: Translate `docs/SETUP.md` preserving runnable setup commands**

Preserve:

```text
bootstrap command
Docker infrastructure
service startup commands
Prisma/migration notes
environment setup
verification commands
```

Expected: a developer can still set up the repository from this file.

---

### Task 6: Validate Language, Roadmap Removal, and Links

**Files:**
- Check: `README.md`
- Check: `docs/*.md`
- Check: `docs/specs/*.md`

**Interfaces:**
- Consumes: rewritten docs.
- Produces: validation evidence for final response.

- [ ] **Step 1: Search for Russian text outside backups**

Run:

```bash
rg "[А-Яа-яЁё]" README.md docs --glob '!oldDocs/**'
```

Expected: no matches outside intentionally preserved proper names. If names such as `Тамилка` appear in examples, replace them with neutral English examples.

- [ ] **Step 2: Search for roadmap wording outside backups**

Run:

```bash
rg -i "in development|planned|todo|надо|в разработке|будущее|future roadmap|coming soon" README.md docs --glob '!oldDocs/**'
```

Expected: no matches outside `docs/superpowers/specs/2026-07-23-final-documentation-as-built-design.md` and this implementation plan. If matches appear in active product or engineering docs, rewrite them.

- [ ] **Step 3: Check Markdown links to local docs**

Run:

```bash
rg "\\]\\((\\./|\\.\\./|docs/)[^)]+\\)" README.md docs --glob '!oldDocs/**'
```

Expected: inspect each link target and confirm it exists. Fix broken paths.

- [ ] **Step 4: Verify old-doc backups are the only accepted Russian archive**

Run:

```bash
rg "[А-Яа-яЁё]" docs/oldDocs
```

Expected: matches are allowed because `docs/oldDocs/` preserves the old engineering baseline.

- [ ] **Step 5: Check git status does not include pre-existing superpowers deletions in the docs rewrite commit**

Run:

```bash
git status --short
```

Expected: documentation rewrite files are modified or added, and the pre-existing deleted `docs/superpowers/...` entries remain unstaged unless the user explicitly asked to include them.

---

### Task 7: Commit Final Documentation Rewrite

**Files:**
- Stage: `README.md`
- Stage: `docs/ARCHITECTURE.md`
- Stage: `docs/DEVELOPMENT.md`
- Stage: `docs/MONOREPO_GOTCHAS.md`
- Stage: `docs/OBSERVABILITY.md`
- Stage: `docs/SETUP.md`
- Stage: `docs/oldDocs/*.md`
- Stage: `docs/specs/*.md`

**Interfaces:**
- Consumes: validated rewritten docs.
- Produces: a single documentation rewrite commit.

- [ ] **Step 1: Stage only the documentation finalization files**

Run:

```bash
git add README.md docs/ARCHITECTURE.md docs/DEVELOPMENT.md docs/MONOREPO_GOTCHAS.md docs/OBSERVABILITY.md docs/SETUP.md docs/oldDocs docs/specs
```

Expected: staging succeeds. The pre-existing deleted `docs/superpowers/...` files are not staged.

- [ ] **Step 2: Confirm staged files**

Run:

```bash
git diff --cached --name-only
```

Expected: output contains README, active docs, oldDocs backups, and specs only.

- [ ] **Step 3: Commit the documentation rewrite**

Run:

```bash
git commit -m "docs: finalize as-built English documentation"
```

Expected: commit succeeds.

- [ ] **Step 4: Report remaining unrelated worktree state**

Run:

```bash
git status --short
```

Expected: either clean except for the pre-existing deleted `docs/superpowers/...` files, or fully clean if the user separately asked to include those deletions.

---

## Self-Review

**Spec coverage:** This plan covers backups, README, product specs, engineering docs, validation checks, and a final commit. It explicitly excludes code changes and old `docs/superpowers/...` deletion handling unless requested.

**Placeholder scan:** The plan contains no placeholder implementation steps. Every task has concrete files, commands, and expected outcomes.

**Consistency check:** `docs/oldDocs/` is produced by Task 1 and excluded from English-only validation in Task 6. Product docs are rewritten as final as-built docs, while engineering docs remain operational references.
