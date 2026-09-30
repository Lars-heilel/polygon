# Monorepo Gotchas & Pitfalls

Non-obvious issues we've already tripped over. Read this before trying to brute-force a broken build.

---

## 1. Tailwind v4 `@source`: Slice Styles Are Not Generated Automatically

Tailwind v4 only scans files covered by `@source`. The single source of truth is `theme.css` in shared (`libs/client/shared/src/styles/theme.css`):

```css
@import 'tailwindcss';
@source "../../../../../apps/client/**/*.{ts,tsx}";
@source "../../../../../libs/client/**/*.{ts,tsx}";
```

**Symptom:** Classes from a newly added slice silently fail to apply (in both dev and build).  
**Fix:** Do not duplicate CSS across individual apps. Instead, make sure the slice matches these two `@source` glob patterns. App-level styles should only re-export from shared (see `DEVELOPMENT §10.1`).

---

## 2. Vite Dev Proxy and `VITE_*` from `process.env`

The client routes traffic to the gateway via proxy (`apps/client/messenger/vite.config.mts`):

- `/api → http://localhost:3000`, `/socket.io → http://localhost:3000` with `ws: true` (configured for both `server` and `preview`).

**The catch:** Nx loads the root `.env` into `process.env` *before* Vite initializes, and Vite gives priority to `process.env` over mode-specific environment files. As a result, `.env.production` does not override `.env`. Because of this, `VITE_API_URL` and `VITE_SOCKET_URL` are explicitly removed in the Vite configuration:

```ts
delete process.env['VITE_API_URL'];
delete process.env['VITE_SOCKET_URL'];
```

**Symptom:** Production preview attempts to connect to `localhost:3000`. Do not patch URLs manually—check this config block and verify `envDir: repoRoot`.

---

## 3. Strict Schema Validation for Env: Running Outside the Root Fails

`env.schema.ts` enforces strict validation (ports must be numbers, URLs must be strings). `dotenv` resolves `.env` relative to the current working directory (`cwd`). Running Jest or Vitest from inside a library directory means `.env` won't be found, leading to a wall of errors:

```
CHAT_PORT: Invalid input: expected number, received NaN
APP_URL: Invalid input: expected string, received undefined
```

**This is not a code bug.** Always run tests via Nx from the workspace root (`npm exec nx -- test ...`). If running `npx jest` directly inside a package, make sure the `cwd` is explicitly pointed to the root.

The same rule applies to `prisma.config.ts`: it resolves `.env` / `.env.test` / `.env.production` based on `NODE_ENV` relative to the library root (`join(__dirname, '../../../...')`)—do not break or alter these `__dirname` paths during refactoring.

---

## 4. MSW is in Dependencies, but Not Used on the Client

While `msw` is declared in the root `package.json`, there are zero handlers or workers in `apps/client` and `libs/client`—and this is by design.

The network layer is mocked using `authedFetch`/socket stubs (`test-stubs/shared.tsx`) instead of network request interception. Do not start adding MSW handlers "out of habit": maintaining two separate network mocking strategies in the same repository will inevitably drift apart and break during the first API client refactoring.

---

## 5. Gateway Tests: Supertest on Top of Mocked RMQ Clients

The established pattern (`auth.http.spec.ts` and related test files): a real NestJS app is bootstrapped via `@nestjs/testing` + `supertest`, while RMQ clients are replaced with `{ send: jest.fn() }` mocks (`of(...)` for success, `throwError(...)` for RPC errors).

Exception filters (`GatewayHttpExceptionFilter`, `ZodValidationExceptionFilter`) and the cookie parser remain real. This ensures test specs validate the actual HTTP contract: status codes, `set-cookie` headers, and 400 validation error payloads.

**Rules:**

- Mock the transport boundary (`ClientProxy`), never the controller itself—otherwise, you are testing your mocks instead of your code.
- Live brokers, databases, and Redis instances are forbidden in unit test runs. Use the dedicated `*-e2e` projects instead, which are excluded from the default `test` target in `nx.json`.
- When asserting cookies in Supertest, always use a `set-cookie` parsing helper (e.g., `getSetCookieHeaders`) instead of a simple string `.toContain()`: the `HttpOnly` and `SameSite` flags matter.
