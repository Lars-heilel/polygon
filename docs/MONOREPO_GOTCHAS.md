# Monorepo Gotchas

Non-obvious specifics that are not covered in the main docs but matter during development.

---

## Tailwind v4 in Nx Monorepo

### How Utilities Are Generated

In Tailwind v4, two types of utilities behave differently:

| Type | Examples | How generated |
| ---- | -------- | ------------- |
| Theme colors (from `@theme`) | `bg-purple-60`, `text-surface`, `border-border` | **Always**, no file scanning needed |
| Core utilities | `p-8`, `rounded-xl`, `flex`, `gap-4` | Only if found in scanned files |

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
