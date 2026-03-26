# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Polygon** is a full-stack messaging/chat platform built as an Nx monorepo. It uses NestJS microservices on the backend and a React 19 SPA on the frontend.

## Setup

```bash
# First-time setup (starts Docker, creates DBs, generates Prisma clients, runs migrations)
./scripts/bootstrap.sh

# Copy environment variables
cp .env.example .env

# Start infrastructure (PostgreSQL, Redis, RabbitMQ)
docker compose up -d
```

Prisma generated files are gitignored (`libs/backend/*/src/database/generated`). Regenerate with:

```bash
cd libs/backend/<service> && npx prisma generate
# or migrate
cd libs/backend/<service> && npx prisma migrate dev
```

## Commands

All tasks run through Nx. The org scope is `@org`.

```bash
# Serve a specific app
npx nx serve @org/gateway
npx nx serve @org/messenger

# Build / test / lint / typecheck — single project
npx nx run @org/<project>:<target>
npx nx build @org/<project>
npx nx test @org/<project>
npx nx test @org/<project> --coverage
npx nx test @org/<project> --testFile=user.service.spec.ts
npx nx lint @org/<project>
npx nx typecheck @org/<project>

# Run multiple targets across projects
npx nx run-many -t build test lint typecheck
npx nx run-many -t build -p @org/user-service @org/auth-service

# Run only affected projects (change detection against base branch)
npx nx affected -t test
npx nx affected -t build test lint

# Useful flags for run / run-many / affected
#   --skipNxCache   — bypass cache, force rerun
#   --verbose       — show stack traces
#   --nxBail        — stop on first failure
#   --configuration=production

# Visualize the dependency graph
npx nx graph
npx nx graph --print | jq '.graph.dependencies["@org/auth"]'

# Inspect full resolved config (includes inferred targets — do NOT rely on project.json alone)
npx nx show project @org/<project> --json
npx nx show project @org/<project> --json | jq '.targets | keys'

# Discover all projects
npx nx show projects
npx nx show projects --type lib
npx nx show projects --withTarget serve

# Format
npx nx format:write

# Troubleshooting
npx nx sync       # fix out-of-sync workspace
npx nx reset      # clear stale cache
```

## Architecture

### Monorepo Layout

```
apps/backend/
  gateway/              # API Gateway — single entry point (port 3000)
  auth-service/         # Authentication (port 3002)
  user-service/         # User profiles (port 3001)
  chat-service/         # Chats & messages (port 3003)
  media-service/        # File handling (port 3004)
  notification-service/ # Notifications (port 3005)

apps/client/
  messenger/            # React 19 + Vite SPA

libs/backend/
  auth/                 # Auth business logic + Prisma schema
  user/                 # User business logic + Prisma schema
  chat/                 # Chat business logic + Prisma schema
  media/                # Media business logic + Prisma schema
  notification/         # Notification business logic + Prisma schema
  core/                 # Shared NestJS DI config

libs/client/            # Feature-Sliced Design (FSD) packages
  entities/             # Business entities (User, Chat, Message)
  features/             # User interactions
  widgets/              # Composite components
  layouts/              # Page layouts
  pages/                # Full pages
  shared/               # Utilities, UI kit

libs/common/            # Framework-agnostic: Zod schemas + constants (imported by both client & backend)
```

### Backend Library Structure

Each `libs/backend/<service>/` follows the same pattern:

- `lib/<service>.module.ts` — NestJS module
- `services/<service>.service.ts` — business logic
- `controllers/<service>.controller.ts` — API endpoints
- `database/prisma/schema.prisma` — data model
- `database/prisma/prisma.service.ts` — Prisma connection
- `database/repository/<service>.prisma.repo.ts` — data access layer
- `dto/` — request/response DTOs (use `createZodDto` from `nestjs-zod`)

Each microservice has its own isolated PostgreSQL database: `polygon_auth`, `polygon_user`, `polygon_chat`, `polygon_media`, `polygon_notification`.

### Inter-Service Communication

All inter-service communication is async via RabbitMQ events. There is no direct HTTP between services — only the Gateway calls services.

### Shared Schemas Pattern (`libs/common`)

Zod schemas in `@org/common` are the single source of truth for validation. They are shared across client and backend:

- **Frontend**: extend schemas for form validation (add `confirmPassword`, etc.)
- **Backend DTOs**: `export class CreateUserDto extends createZodDto(UserSchema)`

### Module Boundary Enforcement (Nx)

Nx enforces strict dependency rules — violations are caught by `npx nx lint`.

**FSD layer rules** (client only):

```
pages → layouts → widgets → features → entities → shared → (external only)
```

Each layer can only import from layers below it.

**Scope rules**:

- `scope:client` cannot import `scope:backend`
- `scope:backend` cannot import `scope:client`
- `scope:shared` (`@org/common`) can be imported by anyone

## Dependencies

All external npm packages are installed at the **root** `package.json` only:

```bash
npm install <package>   # always at repo root
```

Individual lib/app `package.json` files do not list external packages. Nx resolves everything from the root via hoisting. This enforces a single version policy across the monorepo.

## Generating New Projects

```bash
# List available generators
npx nx list
npx nx list @nx/nest
npx nx list @nx/react

# Always dry-run first to verify file placement
npx nx g @nx/nest:library --name=my-lib --dry-run --no-interactive

# Run the generator
npx nx g @nx/nest:library --name=my-lib --no-interactive

# After generating: format, then verify
npx nx format:write
npx nx run-many -t build lint test typecheck
```

Key rules:

- Always use `--no-interactive` to avoid hanging prompts
- `--directory` is the **full path** of the artifact, not the parent (`--directory=libs/backend/my-lib`, not `--directory=libs/backend`)
- Default to **non-buildable** libraries (no `--bundler`) unless publishing to npm
- After generating, wire up dependencies with npm workspace commands — do not manually edit tsconfig paths:
  ```bash
  npm install @org/common --workspace @org/my-new-lib
  ```

## Code Conventions

- **Files**: kebab-case (`user.service.ts`, `create-user.dto.ts`)
- **Classes/Interfaces**: PascalCase
- **Variables/Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- TypeScript strict mode is on — no `any`, explicit return types, no unused locals
- NestJS: constructor-based DI, repository pattern for database access

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
