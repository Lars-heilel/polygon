# Development Guide

## 1. Prerequisites

- Node 22, **NPM only** (`package-lock.json` is the source of truth; never add
  `pnpm-lock.yaml` / `yarn.lock` / `bun.lock` — see `AGENTS.md`).
- Docker Compose for infra (Postgres, Redis, MinIO, RabbitMQ, Meilisearch, observability).
- Run every Nx task via `npm exec nx ...`, never via a global Nx binary.

## 2. Why `apps/` vs `libs/`

- `apps/*` are **deployable entry points**: thin shells (Nest `main.ts` + module, Vite
  `main.tsx` + router/providers). No business logic lives here.
  - Backend: `apps/backend/gateway`, `apps/backend/{auth,user,chat,media,notification,search}-service`.
  - Client: `apps/client/messenger` (4200), `apps/client/admin` (4300, base `/admin/`).
- `libs/*` are **reusable packages** with the real logic, one npm package per slice (`@org/*`):
  - `libs/backend/*` — service implementations (controllers, services, Prisma repos).
  - `libs/client/*` — FSD slices (`entities`, `features`, `pages/*`, `layouts`, `shared`).
  - `libs/common` — framework-agnostic contracts for both sides (see §3).
  - `libs/backend/core` — shared server plumbing (config, Redis, tokens, storage, guards).

Rule: **all code lives in libraries wherever possible; apps only import and wire**.
Entry modules are pure composition with `controllers: []`:

```ts
// apps/backend/user-service/src/app/user.module.ts — the whole app module
imports: [ObservabilityModule.forService(SERVICE_NAMES.user), OrgUserModule],
controllers: [],
```

Same on the client: `apps/client/*` hold only `main.tsx`, router, and providers.

## 3. `libs/common` — Single Source of Truth

All client↔gateway interaction goes through contracts defined in `libs/common/src`. **No hardcoded
URLs, route strings, or ad-hoc shapes** on either side.

| Contract           | Location                                | Rule                                                                                                                                                                                                    |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP paths         | `constants/routes.ts` → `API_ROUTES`    | Gateway `@Controller` roots and every client `apiFetch`/`authedFetch` call must use these (e.g. `API_ROUTES.chats.direct`). Builder functions (`byId(id)`, `read(id)`) instead of string interpolation. |
| Client routes      | `constants/routes.ts` → `CLIENT_ROUTES` | React Router definitions and redirects use these (e.g. guards in `apps/client/messenger/src/app/router/guards.tsx`).                                                                                    |
| Validation + types | `schemas/*` (zod)                       | **New contracts are created here first**, as zod schemas. Types are inferred (`z.infer`), never hand-duplicated. Each schema area has `index.ts` + colocated `*.spec.ts`.                               |
| Shared constants   | `constants/regex/*`, `constants/*`      | Password rules, shared enums — same import path for Nest DTOs and React forms.                                                                                                                          |

Enforcement: `scope:client` cannot import `scope:backend` and vice versa (Nx boundaries) —
the only legal bridge is `type:framework-agnostic` (`libs/common`, core utils).

## 4. How Contracts Flow to Each Side

The base schema in common is the minimal (server) shape. The backend **wraps** it,
the frontend **extends** it. Forked copies of a schema do not exist — one source, two adapters.

**Backend (NestJS).** Nest needs classes for `@Body()`/`@Payload()` metadata, so each DTO wraps
the common schema instead of redeclaring fields (`libs/backend/auth/src/dto/register.dto.ts`):

```ts
import { registerSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerSchema) {}
```

The Gateway validates at the edge (`ZodValidationPipe` / `schema.parse(...)`) and forwards the parsed
shape over RMQ; RMQ pattern strings themselves stay in `libs/backend/core/src/constants/queues/*`
(transport concern, not a client contract).

**Frontend (FSD).** Slices import only what their layer needs from `@org/common`:

```ts
// entities/chat: server state + paths from common
import { API_ROUTES } from '@org/common';
import type { Chat } from '@org/common';
getChats: () => authedFetch<Chat[]>(API_ROUTES.chats.root),
```

- `entities/*` — API functions + React Query hooks + types from common (no route strings).
- `features/*` — mutations/interactions on top of the entity API.
- `pages/*` + `app/router` — composition + `CLIENT_ROUTES` only; `API_ROUTES` in page components
  is forbidden.
- Forms start from the common schema and extend it with UI-only fields via zod
  (`libs/client/features/auth/src/ui/register-form.tsx`):

```ts
// common holds the server truth: email + password + username
import { registerSchema } from '@org/common';

const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
```

The request body sent over the wire stays the base type
(`use-register.ts`: `z.infer<typeof registerSchema>`), so `confirmPassword` never leaves the form.

## 5. NestJS Standards (Backend Libs)

Each backend lib follows the same inner layout (`controllers/`, `services/`, `database/`,
`dto/`, `interfaces/`, `guards/`, `strategies/`, `cache/`, `admin/`):

- **Repository pattern**: `database/prisma/schema.prisma` + `PrismaService` +
  `database/repository/*.prisma.repo.ts` implementing an interface from `interfaces/`.
  Services depend on the interface, never on Prisma directly. Centralize error mapping in
  `handlePrismaError` (`@org/core`).
- **No secrets in logs**: token hashes, provider ids, client metadata must never reach
  `Logger.debug/verbose/log` (covered by the `auth.prisma.repo.spec.ts` convention — copy it).
- **Guards/decorators** come from `@org/core` or `@org/auth` (`SessionGuard`, `ActiveAccountGuard`,
  `RolesGuard`, `@CurrentUser()`, `@ClientMetadata()`); don't reimplement auth checks per controller.
- **Mocks reuse the same DI mechanism**: tests swap implementations behind the existing tokens
  (e.g. `libs/backend/user/src/__mocks__/core.mock.ts`) instead of wiring special test paths.
- **Controllers split by transport**: the Gateway is the only HTTP surface for the frontend
  (`@Controller` + `@Get/@Post/...` + Swagger in `apps/backend/gateway/src/controllers/`).
  Library controllers never speak HTTP — they use `@MessagePattern` (request/reply) and
  `@EventPattern` (fire-and-forget) with `@Payload()`:

```ts
// libs never see HTTP: pure RMQ handlers behind an interface + DI token
export class UserController implements IUserController {
  constructor(@Inject(USER_SERVICE_TOKEN) private readonly userService: IUserService) {}

  @MessagePattern(USER_PATTERNS.GET_BY_ID)
  getById(@Payload() payload: { id: string }) { ... }

  @EventPattern(USER_EVENTS.REGISTERED)
  handleUserRegistered(@Payload() data: CreateUserEventInput) { ... }
}
```

### 5.1. `@org/core` — Swappable Backend Plumbing

`libs/backend/core/src` (`config`, `redis`, `token`, `encryption`, `email`, `storage`, `search`,
`guards`, `decorators`, `observability`, `prisma`, `constants/queues`, `constants/di`) holds
reusable backend-only logic. Everything is consumed through **interfaces + DI tokens**
(`USER_SERVICE_TOKEN`, `USER_CLIENT_TOKEN`, queue names), so any module can be replaced
(e.g. MinIO → S3, Meili → stub in `__mocks__`) without touching consumers. When adding shared
backend capability, put it in core behind a token — never import one service lib from another.

### 5.2. Prisma: One Service, One Database

Production rule is one database per service. In dev this runs as isolated databases on a single
Postgres 18 instance (`infra/db/init` creates `polygon_auth/user/chat/media/notification`).
Every Prisma lib repeats the same `prisma.config.ts` — only the datasource env var changes:

```ts
// libs/backend/{auth,user,chat,...}/prisma.config.ts — identical except url
dotenv.config({ path: envFile }); // .env / .env.test / .env.production by NODE_ENV
export default defineConfig({
  schema: 'src/database/prisma/schema.prisma',
  migrations: { path: 'src/database/prisma/migrations' },
  datasource: { url: process.env['USER_DATABASE_URL'] }, // AUTH_ / CHAT_ / ... per service
});
```

New-service checklist: queue constants + DI tokens in core → `schema.prisma` + identical
`prisma.config.ts` with its own `*_DATABASE_URL` → database in `infra/db/init` →
thin `apps/backend/*-service` wrapper → Gateway RMQ client registration + metrics port.

## 6. Module Boundaries (Nx)

`nx.json → enforceModuleBoundaries` (`allow: []`):

| Tag                                | Must NOT import                                       |
| ---------------------------------- | ----------------------------------------------------- |
| `layer:entities`, `layer:features` | `layer:widgets`, `layer:pages`, `layer:layouts`       |
| `layer:layouts`                    | `layer:pages`                                         |
| `layer:shared`                     | `entities`, `features`, `widgets`, `pages`, `layouts` |
| `scope:client`                     | `scope:backend` (and reverse)                         |
| `type:framework-agnostic`          | anything except `type:framework-agnostic`             |

Check before running tasks via the `nx-workspace` skill; never guess CLI flags.

## 7. Workspaces and Hoisting

- Root `package.json → workspaces` covers `apps/backend/*`, `apps/client/*`, `libs/*`,
  `libs/backend/*`, `libs/client/*`, `features/*`, `pages/*/*`, `entities/*`, `layouts/*`, `widgets/*`.
- Dependencies hoist to the root `node_modules`; each slice keeps its own `package.json`
  (`@org/*`, tags `layer:*` / `scope:*`) with `main: ./src/index.ts` and
  `tsconfig` `customConditions: ["@org/source"]` so Vite/Jest resolve sources, not `dist`.
- If you create a new slice, wire it with the workspace package manager (NPM) — never hand-edit
  cross-package paths to fake a link.

## 8. Env and Prisma Workflow

- `.env` (dev) / `.env.test` / `.env.production` share the same keys: `*_DATABASE_URL` ×5,
  `REDIS_*`, `RABBITMQ_*`, `MEILISEARCH_*`, `MINIO_*`, `JWT_*`, OAuth, SMTP, VAPID, URLs, observability.
- One service, one database — see §5.2 for the `prisma.config.ts` pattern and `infra/db/init`.
- `build` depends on `^build + ^prisma-generate`; `prisma-generate` inputs are
  `prisma.config.ts + src/database/prisma/schema.prisma`.

### 8.1. New Environment Variable: Checklist

Env without validation does not exist. A new variable is registered in four places at once:

**Backend** (`libs/backend/core/src/config/`):

1. `env.schema.ts` — a zod field with the right type (`z.coerce.number()` for ports,
   `z.url()` for URLs, `preprocess` for booleans from strings — see `MINIO_USE_SSL`).
   `CoreConfigModule` (`config.module.ts`) validates via `safeParse` at startup and crashes
   with the field list — that is intended: fail at startup, not with `NaN` at runtime.
2. `.env`, `.env.test`, `.env.production` — a value for each environment
   (`resolveEnvFile()` picks the file by `NODE_ENV`).
3. Infra, if the variable comes from there: `docker-compose.yml` / `infra/observability/*` /
   `docker/demo` (which has its own overrides for `.env.production`).

**Frontend** (`apps/client/<app>/src/app/config/env.ts`):

1. A field in the local zod schema (`VITE_*` — only via `import.meta.env`, there is no other way).
   The reference is messenger: `safeParse` + a clear dev error via `frontendLog`.
   Known inconsistency: admin currently has no validation, only defaults — align it with
   messenger when touching it.
2. A default at the consumption site (`?? '/api'`), so dev through the proxy works without
   extra keys.

Verification: start the gateway and both clients from the repo root — zero env errors. If it
crashes with a field list, don't fix the code, add the keys (see also GOTCHAS §3 on running
outside the root).

## 9. Common Commands

```bash
npm run dev:docker:up        # infra (postgres, redis, minio, rabbitmq, meilisearch)
npm run dev:all              # gateway + messenger + admin + 6 services (parallel)
npm run dev:all:skip-cache   # same, with dist cleanup + --skip-nx-cache
npm run observability:up     # grafana, prometheus, loki, tempo, alloy + exporters

npm exec nx -- run-many --target=build --exclude='@org/*-e2e'
npm exec nx -- run-many --target=test
npm exec nx -- run-many --target=lint
npm exec nx -- affected --target=test
npm run format:check         # nx format:check
npm run demo:build && npm run demo:start   # prod-like monolith in docker/demo
```

## 10. Frontend — FSD Projected onto Packages

FSD layers are enforced as Nx packages with `layer:*` tags (§6), not just folders. The import
rule is the classic one ([layers](https://feature-sliced.design/docs/reference/layers)): **a slice
may import only from layers strictly below it** — `pages → features → entities → shared`.
Same-layer cross-imports are a code smell: compose in an upper layer (`pages`/`app`) instead,
or merge the slices. The only tolerated exception is entities referencing each other, kept
explicit and minimal ([cross-imports](https://feature-sliced.design/docs/guides/issues/cross-imports)).

- **Within one slice**: relative imports with the full path (`../../lib/utils/cn`).
  Never import through the slice's own barrel from inside — that creates cycles.
- **Across slices**: absolute package imports (`@org/shared`, `@org/entities-user`) through the
  slice's public API (`index.ts`) only. Deep imports into another slice's internals are forbidden
  (Nx boundary + review rule).
- New apps assemble from existing slices: `messenger` and `admin` share `@org/shared`,
  `@org/entities-*`, `@org/common` and differ only in router/providers/pages.

### 10.1. Always Small Packages: Reuse Across Apps

Always split into small packages — not for splitting's sake, but for reuse:
messenger / admin / a future market assemble screens from the same `entities` / `features` /
`shared`. Hence the rule: a package must be **app-agnostic** — zero imports from `apps/*`,
only lower layers + common + its own deps in its own `package.json`. App-specific code lives in
`apps/<app>` and `pages/<app>/` and never leaks into shared packages. Convention: `pages/<app>`
is app-specific, everything else is universal.

### 10.2. `@org/shared` — Reusable Foundation

Everything reusable on the client lives here: UI kit, theme, api/socket/query primitives, hooks.
`package.json` sets `"sideEffects": false` so the build can shake the barrel.

- **Styles** (`src/styles/`) — the design foundation. `global.css` only re-exports in a fixed
  order: `theme.css` (Tailwind v4 `@theme` tokens + `@source` for `apps/client` and `libs/client`
  so utilities are generated for all slices), `base.css`, `animations.css`, `vendor.css`, then
  `components/*.css` (bubbles, media-viewer, chat-header). Apps receive styles in one line:

```css
/* apps/client/messenger/src/app/styles/global.css (same in admin) */
@import '@org/shared/styles/global.css';
```

App-level CSS must stay a re-export; component styles belong to `shared/styles/components/`,
never scattered per app — otherwise theming diverges and Tailwind `@source` scanning breaks.

- **UI kit** (`src/ui/<component>/`): one folder per block, each with its own `index.ts` (button/,
  input/, avatar/, modal/, typography/, …). Blocks are pure appearance, no business logic: screens
  assemble like a constructor from ready parts. Never build "a machine that builds constructor
  parts" — no smart wrappers, no logic creeping into the kit.
- **Variants via `cn`** (`src/lib/utils/cn.ts` = `clsx` + `tailwind-merge`): every component
  composes `cva` variants with `cn(...)` and accepts `className` as the last word for call-site
  overrides (`button.tsx`: `cn(buttonVariants({ variant, size }), className)`).
- **Typography** (`src/ui/typography/`): `Heading` (levels 1–6 with responsive sizes
  `text-3xl md:text-4xl lg:text-5xl…`, semantic override via `as`, `srOnly`) and `Text`
  hold all fonts/sizes for desktop–mobile in one place. Text sizing outside these components is
  a bug — fix the kit, don't inline sizes at call sites.
- **Storybook is mandatory**: every `ui/` block ships a colocated `*.stories.tsx`
  (`title: 'UI / …'`, `autodocs`, all variants as stories — see `heading.stories.tsx`).
  Coverage is currently incomplete (12 stories; missing for `dropdown`, `modal`, `toast`,
  `media-viewer`, `virtual-feed`, …) — new components without a story fail review; backfill the
  missing ones opportunistically.

### 10.3. Imports and Code-Splitting

Today `@org/shared` exposes only two subpaths: `.` (the whole barrel) and `./styles/global.css` —
slices pull UI through the barrel (`import { Button } from '@org/shared'`). Per the official
[FSD public-API guidance](https://feature-sliced.design/docs/reference/public-api), a single
`shared/ui` barrel is exactly what breaks tree-shaking and bloats bundles. Rules to stay safe:

1. Keep `sideEffects: false` on every client package — it is what lets Rollup drop unused barrel
   exports in the build.
2. Never import server-heavy modules (socket, query client, audio) through UI-only chunks:
   `manualChunks` in `apps/client/messenger/vite.config.mts` (`chunk-virtuoso`, `chunk-auth-vendor`,
   `chunk-socket`) assumes they stay separable — a UI component importing `socket` silently merges
   the chunks.
3. Route-level splitting: pages are `lazy()`-imported per slice (`@org/pages-*`); keep page
   slices free of eager cross-imports so each route chunk stays lean.
4. If the barrel measurably bloats a chunk, split per the FSD recommendation: one `index.ts`
   per `ui/<component>` already exists, so add subpath exports (`@org/shared/ui/button`) and
   migrate heavy consumers first. Dev-server cost of many barrels (TkDodo) is acceptable here;
   bundle size wins.

When in doubt, run the build with `rollup-plugin-visualizer` (already a dependency) and check
which chunk grew before merging.

### 10.4. Case Study: Why `lazy()` Did Not Split Markdown

Real incident (commits `efcbba7` → `045884e`): the markdown renderer (`react-markdown` +
`react-syntax-highlighter`, ~200 KB) lived inside the monolithic `libs/client/features`
alongside everything else. `lazy()` on the page did nothing — only extracting it into a
separate package produced a separate chunk. Mechanics:

1. **Nx packages are not bundle boundaries.** With the `@org/source` condition Vite bundles
   workspace lib sources as a flat module graph. A `package.json` on a folder splits nothing
   by itself — only import edges decide. Nx doesn't split; Rollup inside the Vite build does.
2. **Static always beats dynamic.** Rollup's rule (Vite prints it verbatim:
   _"dynamically imported but also statically imported, dynamic import will not move module
   into another chunk"_). Markdown was statically reachable — the message list renders it for
   every message (`message-list.tsx` statically imported `MarkdownMessage` from the
   `@org/features` barrel) — so every `lazy()` resolved against the already-bundled copy.
3. **Lazy on a barrel loads the barrel.** All 9 routes did `lazy(() => import('@org/pages'))`
   while `pages/src/index.ts` re-exported auth and messenger pages — Rollup built a single
   ~430 KB chunk with forms, virtuoso, and the whole markdown stack.

The separate package fixed it not by magic but by forcing discipline: one leaf entry
(`@org/features-markdown`), zero static importers in the eager graph, the only reference being
the `lazy()` call, plus a `manualChunks` pin (`chunk-markdown`). Add one static import back and
the problem silently returns.

**Deep imports change nothing.** Rollup chunks resolved modules (absolute file paths), not
specifiers: `import { X } from '@org/features'` (barrel) and
`import { X } from '@org/features/lib/x'` resolve to one file — one module. Bypassing `index.ts`
only affects tree-shaking granularity; it never breaks a static edge. The only cure is cutting
**every** static path from the eager graph to the heavy module.

Rules so this never recurs:

1. Heavy dependency (>30 KB) → its own package with its own public API, not a folder inside a
   shared barrel package. (Heavy vendor inside a regular package infects the whole package.)
2. `lazy()` — only on the package leaf entry, never on a barrel with unrelated code.
3. After adding: grep — zero static importers of the heavy package in the eager graph;
   the chunk exists in the build AND loads on demand in the Network panel. A lazy chunk that is
   never requested at runtime means its contents are already in the parent.
4. Pin heavy vendor via `manualChunks` so shared internals don't get duplicated across
   async chunks.
5. Process trigger: a new npm dependency in a client package = a mandatory review question +
   visualizer/Network check. Regular features stay eager with no ceremony.

## 11. Backend Block: Patterns, Events, Orchestration

### 11.1. Patterns vs Events

All inter-service communication is RabbitMQ. Two primitives — never confuse them:

- **`client.send(PATTERN, payload)` + `@MessagePattern`** — request/reply. The Gateway waits for
  the result and hands it to the frontend. All reads and commands work this way: `chat.getChats`,
  `user.getById`, `auth.login`, `media.initUpload`, `search.users`.
- **`client.emit(EVENT, payload)` + `@EventPattern`** — fire-and-forget. The sender doesn't wait,
  there is no reply. Side effects work this way: `user.registered/updated/deleted` → Meilisearch
  index sync, `send-verification-email`, `send-push`, `push-subscribe/unsubscribe`.

Rules:

1. Result needed for the HTTP response — pattern only. Not needed — event only. An event in
   response to a request is a bug (the gateway returns emptiness before the work is done).
2. Event handlers must survive redelivery (broker redelivery): idempotency by entity key, never
   "create blindly". Request/reply is idempotent by construction — the sender retries `send` itself.
3. New patterns/events are defined in `libs/backend/core/src/constants/queues/*.queue.ts`
   (client DI tokens alongside in `constants/di/*`), the handler lives in the lib controller, and
   frontend exposure goes only through a gateway controller. A service exposed past the gateway
   is forbidden.

### 11.2. Orchestration Lives in the Gateway

Services own only their domain and don't know each other: no sync calls between libs, no foreign
domain imports — only `@org/core` and `@org/common`. Assembling multi-domain responses is the
gateway's job:

- chat list: `chat.getChats` + member enrichment via `user.getManyByIds`;
- profile: `user.*` + role from `auth.get-role-by-id`;
- message send: `chat.sendMessage` → socket broadcast → offline push → cache invalidation.

Consequence: a new cross-domain feature = a new (or extended) gateway controller + ready-made
domain patterns, not links between services. Service coupling must stay zero — verified by the
fact that a lib builds and tests in isolation, with mocked core.

### 11.3. Guards and Decorators: Order Matters

The chain on gateway controllers (outside in):

1. `ThrottlerGuard` (global, `APP_GUARD`, 60s/100) — cuts flooding before auth.
2. `SessionGuard` (or `JwtGuard`) — JWT from `access_token` + session existence in Redis.
3. `ActiveAccountGuard` — Redis marker `ban:{userId}` → 403 `ACCOUNT_BANNED`.
4. `RolesGuard` + `@Roles(...)` — only where needed (admin).

Request data comes through decorators, never by hand: `@CurrentUser()` (JwtPayload),
`@ClientMetadata()` (ip/country/os/browser/device). Don't duplicate auth checks in handler
bodies — that's what the guard layer is for.

### 11.4. Error Contract

Services throw RPC errors with `{ message, status }`; the gateway catches and rethrows them as
`HttpException(message, status)` — the frontend always gets a proper HTTP status.
Entry validation is `ZodValidationPipe` over common schemas (§4); validation errors map via
`ZodValidationExceptionFilter` to 400 with fields. Don't invent custom error formats.

## 12. Testing & Code Style (draft)

**Layout — strictly in place, never "wherever it lands":**

- Unit specs live in `__tests__/` next to the code: `controllers/user.controller.ts` →
  `controllers/__tests__/user.controller.spec.ts`. Specs mixed with sources are forbidden.
- Inside `__tests__/` — a flat list of unit specs; integration specs go in
  `__tests__/integration/`, fixtures in `__tests__/fixtures/`.
- Mocks live in lowercase `__mocks__` next to the mocked module (capitalized `Tests` and other
  variants are forbidden).
- Backend E2E goes in `apps/backend/<name>-e2e` (already excluded from the `test` target in
  `nx.json` so unit runs don't pick it up). Client E2E (Playwright) goes in
  `apps/client/<app>/e2e`.
- Shared client stubs (`authedFetch`, socket, avatar, modal) live only in
  `apps/client/messenger/src/test-stubs/shared.tsx`; don't scatter copies across slices.
- Paths computed from the spec location (`__dirname`, `import.meta.url`) must be fixed by hand
  when moving — `../` mechanics can't see them (the `global-css-contract.spec.ts` case).

- **Backend — Jest:** per-app `jest.config.cts` + shared `jest.preset.js`; run
  `npm exec nx -- run-many --target=test` or `affected`. Services are tested through interfaces
  with mocks behind DI tokens (§5); Prisma repositories with a mocked `PrismaService`.
- **Client — Vitest/Jest + stubs:** per-lib `test-setup.ts` (`vi.restoreAllMocks`).
  MSW is in the root dependencies but unused in client code — the network layer is mocked with
  `authedFetch`/socket stubs, not HTTP interception.
- **Code style:** Prettier + ESLint (`npm run format:check`, `nx format:write`), TypeScript `strict`
  (`noUnusedLocals` etc. — see `tsconfig.base.json`). Imports are sorted
  (`@trivago/prettier-plugin-sort-imports`). New behavior without a spec gets returned from review.

## 13. Logging (draft)

- **Backend — Pino** (`nestjs-pino`, `ObservabilityModule.forService(...)` in every entry module):
  structured JSON logs, levels via `LOG_LEVEL`/`LOG_FORMAT`. Logs are step-by-step so it's visible
  where things break: every significant operation writes `*_requested` → `*_started` →
  `*_done`/`failed` with `eventType` (see `chat.service.ts`: `message_attachment_access_requested`,
  `media_reference_create_started`, …). Context is the class name (`new Logger(X.name)`).
  Raw identifiers and secrets are never logged — only presence facts
  (`hasUserId: !!userId`, `hasChatId: !!chatId`), see §5.
- **Client — `frontendLog` / `useLogger` from `@org/shared` under the same scheme** (levels
  `log/error/warn/debug/verbose`, context name, colors in dev). Logs never reach prod by
  construction: both helpers are no-ops under `import.meta.env.PROD` (verified in code), no
  runtime flags or manual `if`s at call sites.
- User-facing feedback is `toast`/`Toaster` (sonner) and `FormAlert` for forms; bare `console.*`
  must not appear in slices, only through the logger. Client log collection via the gateway
  (`frontend-error`) was removed as overengineering: extra traffic with no benefit, dev and
  server logs are enough.
