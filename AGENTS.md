<!-- READ FIRST: this repo runs on docs/ARCHITECTURE.md, docs/DEVELOPMENT.md, docs/MONOREPO_GOTCHAS.md. Read the relevant one BEFORE touching code. The bullet rules below are a digest — details live in the docs. -->

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Package Manager — NPM only

- This workspace uses **NPM exclusively**. Do NOT use pnpm, yarn or bun — they break the install/layout.
- Nx auto-update likes to re-insert a `pnpm` example into the header above. Ignore it: always run Nx via `npm exec nx ...` (e.g., `npm exec nx run-many --target=build`).
- Source of truth for deps is `package-lock.json`. Never add `pnpm-lock.yaml` / `yarn.lock` / `bun.lock`.

## Hard Rules (digest of the docs — obey without exception)

- **Contracts first:** new client↔gateway shapes start as zod schemas in `libs/common`; backend wraps them (`createZodDto`), frontend extends them (`.extend()` + `.refine()`). No hardcoded routes/URLs — use `API_ROUTES` / `CLIENT_ROUTES`. No forked copies of a schema.
- **Apps are shells:** all code lives in `libs/`; `apps/` only import and wire (Nest modules with `controllers: []`, Vite `main.tsx` + router/providers).
- **Backend transport split:** HTTP controllers exist only in the Gateway; lib controllers use `@MessagePattern` (needs a reply) / `@EventPattern` (fire-and-forget) only. Services never import another service's domain — orchestration lives in the Gateway. New patterns/events go in `libs/backend/core/src/constants/queues/*`.
- **Guards order:** Throttler → Session/Jwt → ActiveAccount → Roles. Request data via `@CurrentUser()` / `@ClientMetadata()`, never parsed by hand.
- **Errors:** services throw RPC errors with `{ message, status }`; the Gateway maps them to `HttpException`. No custom error formats.
- **One service, one database:** new Prisma services copy the identical `prisma.config.ts` with their own `*_DATABASE_URL` + a database in `infra/db/init`.
- **No secrets in logs:** token hashes, provider ids, client metadata, raw ids — only presence flags (`hasUserId: !!userId`) and `eventType` step logs (`*_requested → *_started → *_done`).
- **FSD on packages:** slices import only from layers strictly below (`pages → features → entities → shared`); same-layer cross-imports are forbidden. Inside a slice use relative imports; across slices use the package public API (`index.ts`) only. New reusable units are app-agnostic packages — app-specific code stays in `apps/` and `pages/<app>/`.
- **Heavy deps (>30 KB) get their own package** with a single entry, consumed only via `lazy()` (never a barrel). Verify: zero static importers in the eager graph, chunk present in build, loaded on demand in Network. A new npm dep in a client package always triggers this check in review.
- **Tests:** specs live in `__tests__/` next to the code (integration in `__tests__/integration/`, fixtures in `__tests__/fixtures/`), mocks in lowercase `__mocks__/`. No live broker/DB/Redis in unit runs. New behavior without a spec gets returned from review.
- **Logging:** backend Pino (`ObservabilityModule.forService`), frontend `frontendLog` / `useLogger` from `@org/shared` (no-op in prod by construction). No bare `console.*` in slices; user-facing feedback via `toast` / `FormAlert`.

## Verify After Changes

- `npm exec nx -- affected --target=test` (from repo root — never run jest/vitest with cwd inside a lib, env validation will fail with `NaN`/`undefined` errors)
- `npm run format:check`
- For client bundle impact: build with `rollup-plugin-visualizer` and confirm which chunk grew before merging.

# Workspace Reference Documents

Before implementing features, fixing bugs, or refactoring in this repository, you **MUST** read and understand the following documents to align with the project's architecture, design patterns, and monorepo quirks:

- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**: Outlines the system architecture, including the API Gateway, microservices (Auth, User, Chat, Media, Notification, Search), database-per-service pattern, communication (RabbitMQ events, Socket.IO WebSockets), cookie-based session flow, and client-side FSD layers with sliced packages.
- **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)**: Details the coding conventions, directory layout, TypeScript & NestJS standards (e.g., repository pattern), module boundary rules, package hoisting in the monorepo, and common CLI commands.
- **[`docs/MONOREPO_GOTCHAS.md`](docs/MONOREPO_GOTCHAS.md)**: Highlights critical, non-obvious gotchas such as Tailwind v4 `@source` setup, Vite Dev Proxy for APIs/WebSockets, environment variable parsing across services/Prisma, MSW mocks in multi-lib layouts, and Gateway supertest strategies.

Always check these documents first to preserve established conventions!
