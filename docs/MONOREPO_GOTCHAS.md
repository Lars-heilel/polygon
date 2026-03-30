# Monorepo Gotchas

Non-obvious specifics that are not covered in the main docs but matter during development.

---

## Tailwind v4 in Nx Monorepo

### How Utilities Are Generated

In Tailwind v4, two types of utilities behave differently:

| Type                         | Examples                                        | How generated                       |
| ---------------------------- | ----------------------------------------------- | ----------------------------------- |
| Theme colors (from `@theme`) | `bg-purple-60`, `text-surface`, `border-border` | **Always**, no file scanning needed |
| Core utilities               | `p-8`, `rounded-xl`, `flex`, `gap-4`            | Only if found in scanned files      |

**Symptom:** `bg-purple-60` works, but `p-8` or `rounded-xl` do not.

### Fix — `@source` in global.css

The `@tailwindcss/vite` plugin configured in `apps/client/messenger/vite.config.mts` does not always pick up files from `libs/` through the module graph. Add explicit source paths to `libs/client/shared/src/styles/global.css`:

```css
@import 'tailwindcss';
@source "../../../../../apps/client/**/*.{ts,tsx}";
@source "../../../../../libs/client/**/*.{ts,tsx}";
```

> Paths are relative to the CSS file itself.
> From `libs/client/shared/src/styles/global.css` to the root — **5 levels up** (`../../../../../`).
>
> `styles/` → `src/` → `shared/` → `client/` → `libs/` → **root**

### VSCode IntelliSense

Tailwind v4 has no `tailwind.config.js`. Point the `bradlc.vscode-tailwindcss` extension to the CSS file manually in `.vscode/settings.json`:

```json
{
  "tailwindCSS.experimental.configFile": "libs/client/shared/src/styles/global.css"
}
```

---

## Vite Dev Proxy

In development, the Vite dev server runs on port `4200` while the API Gateway runs on port `3000`. To avoid CORS issues and to expose only a single port for tunneling, Vite proxies `/api` and `/socket.io` to the gateway.

Configured in `apps/client/messenger/vite.config.mts`:

```ts
server: {
  port: 4200,
  host: true,          // bind to all interfaces — required for ngrok / LAN access
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
    '/socket.io': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      ws: true,          // proxy WebSocket upgrades
    },
  },
},
```

### Adding a new Vite app to the monorepo

If you scaffold a new frontend app (`npx nx g @nx/react:app`), add the same `proxy` block to its `vite.config.mts`. Without it:

- API requests will hit `localhost:<new-app-port>/api` and return 404
- WebSocket connections will fail
- ngrok will only tunnel the frontend, breaking all API calls

### Why `host: true`

By default Vite binds to `localhost` only, which blocks access from other machines (including ngrok). `host: true` makes it listen on `0.0.0.0` — required for any remote access.

---

## Environment Variables

A single `.env` file lives at the **repository root**. Each tool resolves it differently.

### Vite (frontend)

`apps/client/messenger/vite.config.mts` explicitly points to the root via `envDir`:

```ts
export default defineConfig(() => ({
  envDir: '../../..', // 3 levels up from apps/client/messenger/ → root
}));
```

Frontend variables must be prefixed with `VITE_`:

```env
VITE_API_URL=http://localhost:3000/api
```

### NestJS Services (backend)

NestJS reads `process.env.*` directly. When running via `nx serve`, Nx loads `.env` from the root automatically — no additional config needed.

### Prisma (migrations and generate)

Prisma CLI runs from the specific lib directory (`cd libs/backend/<service>`), so `dotenv/config` without parameters looks for `.env` in the CWD — which may be the wrong directory.

Each lib has a `prisma.config.ts`. Two approaches are used in the project:

**Option A — explicit path (more reliable):**

```ts
// libs/backend/auth/prisma.config.ts
import * as dotenv from 'dotenv';
import path, { join } from 'path';

const envFile = path.resolve(join(__dirname, '../../../.env'));
dotenv.config({ path: envFile });
// 3 levels up: auth/ → backend/ → libs/ → root
```

**Option B — dotenv/config without parameters:**

```ts
// libs/backend/user/prisma.config.ts
import 'dotenv/config';
```

Works only when the command is run from the repository root (which is what `npx nx` does).

> **Rule:** when running Prisma directly from the lib directory — use Option A.
> When running via `npx nx run @org/<service>:migrate` — both options work.

### Summary

```
Repository root
└── .env                          ← single env file

apps/client/messenger/
└── vite.config.mts               ← envDir: '../../..'  (3 levels up)

libs/backend/auth/
└── prisma.config.ts              ← __dirname + '../../../.env'  (3 levels up)

libs/backend/user|chat|.../
└── prisma.config.ts              ← import 'dotenv/config'  (works via nx)
```

---

## MSW in Multi-lib Frontend

MSW handlers are defined in `libs/client/entities/src/test/handlers/` and shared across libs. Each lib that needs API mocking has its own `src/test/server.ts` that imports from that location.

**Why not import from `@org/entities`?**
Test utilities should not be part of a lib's public API (`src/index.ts`). Exporting `server` from the public API would include test code in production builds.

**Pattern for libs that need MSW:**

```
libs/client/<lib>/
  src/
    test/
      server.ts          ← setupServer(...handlers)
      handlers/          ← lib-specific handlers (if any)
    test-setup.ts        ← beforeAll/afterEach/afterAll wiring
```

`test-setup.ts` in each lib:

```ts
import { server } from './test/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Adding a new handler:**

1. Add handler to `libs/client/entities/src/test/handlers/auth.handlers.ts` (or create a new file for another domain)
2. Export it from `libs/client/entities/src/test/handlers/index.ts`
3. All `server.ts` files that import `authHandlers` pick it up automatically

**Overriding a handler in a specific test:**

```ts
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';

it('handles login failure', () => {
  server.use(
    http.post('/api/auth/login', () =>
      HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    )
  );
  // ... test
});
```

---

## Testing the Gateway (Supertest + Mocked Microservices)

The Gateway communicates with microservices via RabbitMQ `ClientProxy`. Integration tests use `NestJS TestingModule` + Supertest with the real HTTP layer but mocked clients — no RabbitMQ or running services required.

**Setup helper:** `apps/backend/gateway/src/test/create-test-app.ts`

```ts
const authClient = { send: jest.fn().mockReturnValue(of({})), emit: jest.fn() };

const moduleRef = await Test.createTestingModule({
  imports: [CoreConfigModule, CoreTokenModule],
  controllers: [AuthGatewayController],
  providers: [
    { provide: AUTH_CLIENT_TOKEN, useValue: authClient },
    // ...other mocked clients
  ],
}).compile();
```

**What this tests:**

- HTTP status codes, request validation (ZodValidationPipe), cookie handling
- Guards and middleware behavior
- Error mapping from microservice exceptions to HTTP responses

**What this does NOT test:**

- Business logic inside microservices (test those in their own lib specs)
- Real database state

**POST handlers return 201 by default in NestJS** (not 200) unless `@HttpCode(200)` is added to the method. Account for this in test assertions.
