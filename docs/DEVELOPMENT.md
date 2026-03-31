# Development Guide

---

## Nx Workspace

Nx is the build system and task runner for this monorepo. Key concepts:

- **Project graph** — Nx tracks dependencies between all projects. Run `npx nx graph` to visualize.
- **Caching** — task results (build, test, lint) are cached. Re-running an unchanged project is instant.
- **Affected** — `npx nx affected -t test` runs tests only for projects changed since the base branch.

All projects are referenced by their `@org/<name>` package name.

### Common Commands

```bash
# Serve
npx nx serve @org/gateway
npx nx serve @org/messenger

# Build / test / lint / typecheck
npx nx build @org/<project>
npx nx test @org/<project>
npx nx lint @org/<project>
npx nx typecheck @org/<project>

# Run multiple targets
npx nx run-many -t build test lint typecheck
npx nx affected -t test

# Inspect a project's resolved config and available targets
npx nx show project @org/<project> --json
npx nx show project @org/<project> --json | jq '.targets | keys'

# Fix out-of-sync workspace / clear stale cache
npx nx sync
npx nx reset
```

---

## Project Structure

```
polygon/
├── apps/
│   ├── backend/
│   │   ├── gateway/              # API Gateway — single entry point (port 3000)
│   │   ├── auth-service/         # Authentication (port 3002)
│   │   ├── user-service/         # User profiles (port 3001)
│   │   ├── chat-service/         # Chats & messages (port 3003)
│   │   ├── media-service/        # File handling (port 3004)
│   │   └── notification-service/ # Notifications (port 3005)
│   └── client/
│       └── messenger/            # React 19 + Vite SPA
│
├── libs/
│   ├── backend/
│   │   ├── auth/                 # Auth business logic + Prisma schema
│   │   ├── user/                 # User business logic + Prisma schema
│   │   ├── chat/                 # Chat business logic + Prisma schema
│   │   ├── media/
│   │   ├── notification/
│   │   └── core/                 # Shared NestJS infrastructure (logging, filters, health)
│   ├── client/                   # Feature-Sliced Design layers (see below)
│   │   ├── shared/               # UI kit, utilities, API client
│   │   ├── entities/             # Business entities and their API hooks
│   │   ├── features/             # User-facing features (auth, theme, ...)
│   │   ├── widgets/              # Composite components
│   │   ├── layouts/              # Page layouts
│   │   └── pages/                # Standalone pages (e.g. 404)
│   └── common/                   # Framework-agnostic: Zod schemas + constants
│
├── scripts/                      # bootstrap.sh, init-db.sh
├── infra/                        # Docker, Prometheus, Grafana config
└── docs/
```

### Dependency Installation

All external packages are installed at the **repository root** only:

```bash
npm install <package>   # always at repo root
```

Individual lib `package.json` files do not list external packages — Nx resolves everything from the root via hoisting. This enforces a single version policy across the monorepo.

---

## Module Boundaries

Nx enforces dependency rules via the `@nx/enforce-module-boundaries` ESLint rule. Projects declare their identity through tags in `package.json`:

```json
{
  "nx": {
    "tags": ["layer:features", "scope:client"]
  }
}
```

### Tags in Use

| Tag                       | Projects             |
| ------------------------- | -------------------- |
| `scope:client`            | All `libs/client/*`  |
| `scope:backend`           | All `libs/backend/*` |
| `scope:shared`            | `libs/common`        |
| `layer:shared`            | `@org/shared`        |
| `layer:entities`          | `@org/entities`      |
| `layer:features`          | `@org/features`      |
| `layer:widgets`           | `@org/widgets`       |
| `layer:layouts`           | `@org/layouts`       |
| `layer:pages`             | `@org/pages`         |
| `type:business`           | Backend service libs |
| `type:core`               | `@org/core`          |
| `type:framework-agnostic` | `@org/common`        |

### Boundary Rules

Configured in the root `.eslintrc.json` under `@nx/enforce-module-boundaries`:

```
FSD layer order (can only import from layers below):
  pages → layouts → widgets → features → entities → shared

Scope rules:
  scope:client  — cannot import scope:backend
  scope:backend — cannot import scope:client
  scope:shared  — can be imported by anyone
```

Check for violations:

```bash
npx nx lint @org/<project>
npx nx run-many -t lint
```

---

## Code Conventions

### Naming

| Subject               | Convention       | Example                                 |
| --------------------- | ---------------- | --------------------------------------- |
| Files                 | kebab-case       | `user.service.ts`, `create-user.dto.ts` |
| Classes / Interfaces  | PascalCase       | `UserService`, `CreateUserDto`          |
| Variables / Functions | camelCase        | `getUserById`                           |
| Constants             | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`                       |

### TypeScript

- `strict: true` — no exceptions
- No `any` — use `unknown` and narrow explicitly
- Explicit return types on public functions and methods
- No unused locals or parameters

### NestJS

- Constructor-based DI only — no property injection
- Repository pattern for all database access — controllers and services never touch Prisma directly
- Each backend lib follows the same internal structure:

```
libs/backend/<service>/
  lib/<service>.module.ts
  services/<service>.service.ts
  controllers/<service>.controller.ts
  database/
    prisma/schema.prisma
    prisma/prisma.service.ts
    repository/<service>.prisma.repo.ts
  dto/
```

---

## Shared Logic (`@org/common`)

`libs/common` is the single source of truth for validation schemas and constants. It is framework-agnostic and can be imported by both client and backend.

### Zod Schemas

Define schemas once, use everywhere:

```typescript
// libs/common/src/schemas/auth.ts
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

**Frontend** — extend for form-specific needs:

```typescript
// libs/client/features/src/lib/auth/ui/register-form.tsx
import { registerSchema } from '@org/common';

const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
```

**Backend** — create NestJS DTOs via `createZodDto`:

```typescript
// libs/backend/auth/src/dto/login.dto.ts
import { loginSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(loginSchema) {}
```

`ZodValidationPipe` (applied globally in each service) automatically validates incoming requests against the DTO schema and returns a `400 Bad Request` on failure.

---

## Client Architecture — FSD in a Monorepo

The client follows **Feature-Sliced Design (FSD)**. Each FSD layer is a separate Nx library under `libs/client/`:

```
@org/shared    ←  UI kit, utilities, API client
@org/entities  ←  business entities + TanStack Query hooks
@org/features  ←  user-facing features
@org/widgets   ←  composite components
@org/layouts   ←  page layouts
@org/pages     ←  standalone pages (e.g. NotFoundPage)
```

The actual application (`apps/client/messenger`) composes these layers: router, providers, app-level layouts, and pages live there.

### Internal Structure of a Feature

Each feature inside `libs/client/features/src/lib/` is split into two segments:

```
lib/auth/
  ui/             # React components consumed by pages
  model/          # Hooks and state logic consumed by ui/ or pages
  index.ts        # Public API of this feature
```

Keep `ui/` and `model/` focused on **one feature only**. If you open `auth/ui/` you should immediately understand what every file does — because everything there is about authentication. A folder with 20 components of mixed purpose is a signal to split into separate features.

### Public API

Every lib and every feature exposes a public API through `index.ts`. This file is the **contract** — it explicitly declares what the outside world is allowed to use. Anything not listed there is an implementation detail.

```typescript
// libs/client/features/src/lib/auth/index.ts
export { LoginForm } from './ui/login-form';
export { RegisterForm } from './ui/register-form';
export { useLogin } from './model/use-login';
export { useRegister } from './model/use-register';
// ForgotPasswordForm is intentionally not exported — only used inside the feature
```

The lib-level `src/index.ts` re-exports from each feature's `index.ts`:

```typescript
// libs/client/features/src/index.ts
export * from './lib/auth';
export * from './lib/theme';
```

Consumers always import from the package name — never from internal paths:

```typescript
// ✅ correct
import { LoginForm, useLogin } from '@org/features';

// ❌ wrong — bypasses the contract, breaks on any internal refactor
import { LoginForm } from '@org/features/src/lib/auth/ui/login-form';
```

This means you can freely restructure internals (rename files, split segments, move code) without touching any consumer — as long as `index.ts` stays the same.
