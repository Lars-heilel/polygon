# Development Guide

## Nx Workspace

Nx owns project discovery, dependency analysis, task caching, and module-boundary enforcement. Projects are named `@org/<name>`. Run Nx through the repository package manager so the installed version and plugins are used consistently.

```bash
# Development servers
npm exec nx serve @org/gateway
npm exec nx serve @org/messenger

# Per-project verification
npm exec nx build @org/<project>
npm exec nx test @org/<project>
npm exec nx lint @org/<project>
npm exec nx typecheck @org/<project>

# Workspace and change-aware tasks
npm exec nx run-many -t build test lint typecheck
npm exec nx affected -t test
npm exec nx graph

# Inspect targets and repair generated Nx state/cache
npm exec nx show project @org/<project> --json
npm exec nx sync
npm exec nx reset
```

Use `npm exec nx` rather than a global `nx` or direct underlying tool. Inspect `npm exec nx show project <project> --json` before relying on an unfamiliar target or flag. The affected command depends on a meaningful base revision; state that revision explicitly in CI when necessary.

## Repository Layout

```text
apps/backend/     Gateway and service applications
apps/client/      Vite React applications
libs/backend/     Service domain modules and backend core
libs/client/      FSD mini-packages
libs/common/      Framework-agnostic Zod schemas and constants
infra/            Docker and observability configuration
scripts/          Bootstrap and database helpers
```

External dependencies belong in the root `package.json`. Individual Nx libraries resolve them through the workspace dependency graph and package hoisting. Do not add competing dependency versions to nested package manifests.

## Module Boundaries

Nx enforces `@nx/enforce-module-boundaries` using `nx.tags` in `package.json`.

| Tag | Meaning |
| --- | --- |
| `scope:client` / `scope:backend` | Client and backend code must not import each other |
| `scope:shared` | Framework-agnostic code that either side may consume |
| `layer:shared`, `layer:entities`, `layer:features`, `layer:layouts`, `layer:pages` | Client FSD layer |
| `type:business`, `type:core`, `type:framework-agnostic` | Backend/common role |

Client imports must follow the FSD direction:

```text
pages -> layouts -> widgets -> features -> entities -> shared
```

There is currently no widget slice to treat as a general dumping ground. A page may use a feature, but a feature must not import a page. Validate boundary changes with `npm exec nx lint @org/<project>`.

Every library exposes a public API from its root `index.ts`. Import `@org/features-auth`, not `@org/features-auth/src/...`; the latter bypasses the contract and breaks internal refactors.

## TypeScript And Backend Conventions

- Keep TypeScript strict. Do not introduce `any`; use `unknown` and narrow it.
- Use `kebab-case` file names, `PascalCase` types/classes, `camelCase` values/functions, and `UPPER_SNAKE_CASE` constants.
- Public functions and methods have explicit return types. Do not leave unused values or parameters.
- NestJS uses constructor injection only. Do not add property injection.
- Use the repository pattern for Prisma access. Controllers and domain services do not call Prisma directly.
- A service library normally keeps its module, services, controllers, DTOs, Prisma schema/service, and repository together under `libs/backend/<service>/src`.
- Share validation through `@org/common` Zod schemas and turn schemas into DTOs with `createZodDto`; `ZodValidationPipe` applies the DTO contract at service boundaries.

The gateway may adapt HTTP to RPC, but it must not duplicate service-owned business rules. A service must never query another service's database; use RabbitMQ contracts.

## Client Conventions

Client code is arranged as FSD mini-packages rather than one package per layer. This preserves code splitting: a lazy page imports only the entity/feature/layout packages it needs.

`@org/shared` owns semantic tokens, reusable UI components, common viewers, forms, feedback states, the API client, Socket.IO setup, and browser observability helpers. New code should use its `Text`, `Heading`, `Button`, `IconButton`, `Input`, `Textarea`, `Toggle`, `Dropdown`, `Modal`, `Badge`, `Spinner`, `Skeleton`, `FormAlert`, `EmptyState`, `StatusScreen`, and `Toast` primitives where applicable.

Feature and page Tailwind classes should primarily describe layout and geometry. Put colors, typography variants, borders, focus rings, disabled states, loading states, and reusable action variants in shared primitives or semantic tokens. `libs/client/shared/src/styles/global.css` owns Tailwind v4 sources, theme tokens, base document styles, and unavoidable third-party integration overrides; do not add broad selector hacks there.

Keep a feature focused on one user capability. Expose its UI and model through the feature's public entry point, and split an unfocused directory before it becomes a miscellaneous component collection.

## Logging And Observability Contract

Any feature, bug fix, or refactor must assess its observability contract: what needs diagnosis, where it is logged, which data is unsafe, and what tests protect that behavior.

Use safe lifecycle event names for meaningful state transitions:

- `*_requested` when an action reaches the system;
- `*_validated` or `*_validation_failed` for non-trivial validation;
- `*_denied` for authorization, membership, ownership, limit, or state rejection;
- `*_started` before an external or expensive operation;
- `*_succeeded`, `*_completed`, `*_created`, `*_updated`, or `*_deleted` after a durable change;
- `*_failed` for a classified expected failure;
- `*_skipped` for an intentional no-op branch.

Log context as booleans (`hasUserId`), categories, counts, durations, and result/status values. Do not log raw user/chat/file IDs, message text, request payloads, cookies, tokens, signed URLs, database URLs, OAuth credentials, MinIO credentials, SMTP credentials, VAPID keys, or Redis/RabbitMQ secrets.

Use Nest `Logger` or backend-core logging on the backend. Use `useLogger(context)` in React hooks/components and `frontendLog` in non-hook client code. Direct `console.*` is permitted only inside the shared logger/reporter implementation. Development logging may be detailed through those helpers; the production/demo browser console must remain clean. Report production browser failures only through the designated error reporter and never add URL query/hash or raw request data.

When a flow crosses services, the gateway and each owning service log their own stage with compatible event families. Extend tests to cover safe event shape/redaction and success, denied/failed, and skipped paths where the flow has them. See [OBSERVABILITY.md](./OBSERVABILITY.md) for the stack and runbook.

## Testing Strategy

Choose the narrowest test that proves the changed contract, then broaden it when a shared boundary changes.

- Service tests cover business rules, repositories, and event behavior in the owning library.
- Gateway controller tests use Nest `TestingModule` and Supertest with mocked RabbitMQ `ClientProxy` instances; they exercise HTTP status mapping, DTO validation, cookies, guards, and adapter behavior without requiring RabbitMQ or service databases.
- Socket tests cover authentication, membership, room behavior, and emitted events.
- Client tests cover hooks/components with MSW and test utilities; browser e2e covers high-value user workflows.
- Add regression coverage for session revocation whenever private-route or Socket.IO guard behavior changes.

For gateway POST tests, expect Nest's default `201` unless the controller explicitly sets `@HttpCode(200)`. Do not mistake a controller integration test for a full microservice/database integration test.

## Before Submitting A Change

1. Run the relevant Nx lint, test, typecheck, and build targets.
2. Check module boundaries and public package imports.
3. Review new logging for raw payloads, identifiers, credentials, query strings, and browser `console.*` calls.
4. For private endpoints, confirm `SessionGuard`, `ActiveAccountGuard`, and any role checks match adjacent routes.
5. Update maintenance documentation when the runtime contract, setup procedure, or a known gotcha changes.
