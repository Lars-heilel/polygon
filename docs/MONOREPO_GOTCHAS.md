# Monorepo Gotchas

These details are easy to miss because they emerge from the Nx, Vite, Prisma, and multi-package test setup together. Keep this document aligned with configuration changes.

## Tailwind v4 Source Discovery

Tailwind v4 theme utilities declared in `@theme` can appear to work even when utility generation is incomplete. Layout utilities such as `p-8`, `rounded-xl`, `flex`, and `gap-4` are generated only from scanned source files.

If semantic color classes work but ordinary layout utilities do not, first inspect the `@source` paths in `libs/client/shared/src/styles/global.css`:

```css
@import 'tailwindcss';
@source "../../../../../apps/client/**/*.{ts,tsx}";
@source "../../../../../libs/client/**/*.{ts,tsx}";
```

The paths are relative to that CSS file. It is five directories from `libs/client/shared/src/styles/global.css` to the repository root. Do not remove either path when moving a client slice or creating another source root.

Tailwind v4 does not use a required `tailwind.config.js` for this setup. Configure VS Code Tailwind IntelliSense to use the CSS entry point:

```json
{
  "tailwindCSS.experimental.configFile": "libs/client/shared/src/styles/global.css"
}
```

## Vite Development Proxy

The messenger runs on port `4200` and the gateway on port `3000`. `apps/client/messenger/vite.config.mts` proxies both `/api` and `/socket.io` to the gateway.

```ts
server: {
  port: 4200,
  host: true,
  proxy: {
    '/api': { target: 'http://localhost:3000', changeOrigin: true },
    '/socket.io': { target: 'http://localhost:3000', changeOrigin: true, ws: true },
  },
}
```

The `ws: true` option is required for Socket.IO upgrades. `host: true` binds Vite to all interfaces, which is required for LAN and tunnel access. Copy the proxy block when creating another Vite browser application; otherwise API requests target the Vite port and WebSocket connections fail. Open or tunnel port `4200`, not the gateway separately, when using the configured development proxy.

The preview server also carries this proxy contract. Keep development and preview behavior in sync when changing it.

## Root Environment Files And Prisma

The repository environment files are rooted at the repository. Vite sets `envDir` to the root and client variables must start with `VITE_`.

```env
VITE_API_URL=http://localhost:3000/api
```

Nx loads root environment values for service tasks, but direct Prisma invocation is a different execution context. Each Prisma configuration resolves the root environment file explicitly and selects `.env`, `.env.test`, or `.env.production` from `NODE_ENV`.

```ts
const envFile = path.resolve(join(__dirname, `../../../${envFileName}`));
dotenv.config({ path: envFile });
```

The three `..` segments are deliberate: `libs/backend/<service>` to the repository root. When adding a Prisma-backed service, replicate this explicit path strategy. Do not assume `dotenv/config` will find the root file if Prisma is launched from a library directory.

Run project tasks through Nx, for example `npm exec nx <target> @org/<service>`, rather than invoking a library's Prisma command from an arbitrary working directory. Verify the project's actual target before documenting a migration command.

## MSW In Client Mini-Packages

There is no monolithic `@org/entities` package that can own all browser mocks. In the sliced client layout, share MSW handlers from a deliberate test utility location or keep a narrowly-scoped server beside the slice that owns the behavior.

```text
libs/client/<slice>/src/
  test/server.ts
  test-setup.ts
```

Each test server must use strict unhandled-request behavior and lifecycle cleanup:

```ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Use `server.use(...)` for a test-specific response instead of weakening global handlers. If several slices need the same transport fixtures, add an Nx `libs/client/test-utils` library with valid tags and public exports; do not import a sibling slice's internals.

## Gateway Supertest With Mocked Microservices

Gateway controller integration tests use a real Nest HTTP layer and Supertest, but replace RabbitMQ `ClientProxy` providers with mocks. This isolates gateway behavior from RabbitMQ, service processes, and databases while preserving route/guard/pipeline behavior.

```ts
const authClient = {
  send: jest.fn().mockReturnValue(of({})),
  emit: jest.fn(),
};

const moduleRef = await Test.createTestingModule({
  imports: [CoreConfigModule, CoreTokenModule],
  controllers: [AuthGatewayController],
  providers: [{ provide: AUTH_CLIENT_TOKEN, useValue: authClient }],
}).compile();
```

Provide every dependency required by the controller, its guards, and global pipes. These tests should prove HTTP status codes, Zod DTO validation, cookie behavior, `SessionGuard`/account/role handling, and RPC error mapping. They do not prove the service's domain rules or real database state; cover those in the owning service tests.

Nest POST handlers return `201` by default. Assert `200` only when the endpoint has an explicit `@HttpCode(200)`.

## Nx Package And Cache Behavior

Install external dependencies at the workspace root. Project package names and `nx.tags` are part of the dependency contract, so a new package without tags may compile locally but fail boundary lint or produce invalid imports.

When generated Nx state becomes inconsistent, use:

```bash
npm exec nx sync
npm exec nx reset
```

Run `npm exec nx show project @org/<project> --json` before guessing a target. Do not solve Nx cache problems by deleting unrelated source or generated configuration.
