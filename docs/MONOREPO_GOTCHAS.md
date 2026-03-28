# Monorepo — нюансы и подводные камни

Здесь собраны неочевидные вещи, которые не описаны в базовом README но важны при разработке.

---

## Tailwind v4 в Nx монорепо

### Как генерируются утилиты

В Tailwind v4 два типа утилит ведут себя по-разному:

| Тип | Примеры | Как генерируется |
|-----|---------|-----------------|
| Тема-цвета (из `@theme`) | `bg-purple-60`, `text-surface`, `border-border` | **Всегда**, без сканирования файлов |
| Core-утилиты | `p-8`, `rounded-xl`, `border-2`, `flex`, `gap-4` | Только если найдены в сканируемых файлах |

**Симптом проблемы:** `bg-purple-60` работает, а `p-8` или `rounded-xl` — нет.

### Решение — `@source` в global.css

`@tailwindcss/vite` плагин сконфигурирован в `apps/client/messenger/vite.config.mts` и не всегда подхватывает файлы из `libs/` через module graph.

Явно добавляем пути в `libs/client/shared/src/styles/global.css`:

```css
@import 'tailwindcss';
@source "../../../../../apps/client/**/*.{ts,tsx}";
@source "../../../../../libs/client/**/*.{ts,tsx}";
```

> **Важно:** пути считаются относительно самого CSS файла.
> От `libs/client/shared/src/styles/global.css` до корня — **5 уровней** (`../../../../../`).
>
> Структура: `styles/` → `src/` → `shared/` → `client/` → `libs/` → **корень**

### VSCode автодополнение

В Tailwind v4 нет `tailwind.config.js`. Расширению `bradlc.vscode-tailwindcss` нужно указать CSS-файл вручную в `.vscode/settings.json`:

```json
{
  "tailwindCSS.experimental.configFile": "libs/client/shared/src/styles/global.css"
}
```

---

## Переменные окружения (.env)

Единственный `.env` файл лежит в **корне репозитория**. Каждый инструмент ищет его по-своему.

### Vite (фронтенд)

`apps/client/messenger/vite.config.mts` явно указывает на корень через `envDir`:

```ts
export default defineConfig(() => ({
  envDir: '../../..', // 3 уровня вверх от apps/client/messenger/ → корень
}));
```

Переменные для Vite должны иметь префикс `VITE_`:

```env
VITE_API_URL=http://localhost:3000/api
```

### NestJS сервисы (бэкенд)

NestJS читает `process.env.*` напрямую. Nx при запуске `nx serve` подгружает `.env` из корня автоматически — дополнительной настройки не требуется.

### Prisma (миграции и generate)

Prisma CLI запускается из директории конкретной либы (`cd libs/backend/<service>`), поэтому `dotenv/config` без параметров ищет `.env` в CWD — что может быть неправильной директорией.

Каждая либа имеет `prisma.config.ts`. Два подхода используются в проекте:

**Вариант A — явный путь (надёжнее):**
```ts
// libs/backend/auth/prisma.config.ts
import * as dotenv from 'dotenv';
import path, { join } from 'path';

const envFile = path.resolve(join(__dirname, '../../../.env'));
dotenv.config({ path: envFile });
// 3 уровня вверх: auth/ → backend/ → libs/ → корень
```

**Вариант B — dotenv/config без параметров:**
```ts
// libs/backend/user/prisma.config.ts
import 'dotenv/config';
```
Работает только если команда запускается из корня репозитория (что и происходит через `npx nx`).

> **Правило:** при запуске Prisma напрямую из директории либы — используй явный путь (Вариант A).
> При запуске через `npx nx run @org/<service>:migrate` — оба варианта работают.

### Итоговая шпаргалка

```
Корень репозитория
└── .env                          ← единственный env файл

apps/client/messenger/
└── vite.config.mts               ← envDir: '../../..'  (3 уровня вверх)

libs/backend/auth/
└── prisma.config.ts              ← __dirname + '../../../.env'  (3 уровня вверх)

libs/backend/user|chat|.../
└── prisma.config.ts              ← import 'dotenv/config'  (работает через nx)
```
