# Подводные камни монорепозитория (Monorepo Gotchas)

Неочевидные детали, которые не описаны в основной документации, но важны при разработке.

---

## Tailwind v4 в Nx Monorepo

### Как генерируются утилиты

В Tailwind v4 два типа утилит ведут себя по-разному:

| Тип                            | Примеры                                          | Как генерируются                                       |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------ |
| Цвета темы (из `@theme`)       | `bg-purple-60`, `text-surface`, `border-border`  | **Всегда**, без сканирования файлов                    |
| Базовые утилиты                | `p-8`, `rounded-xl`, `flex`, `gap-4`             | Только если найдены в сканируемых файлах               |

**Симптом:** `bg-purple-60` работает, а `p-8` или `rounded-xl` — нет.

### Исправление — `@source` в global.css

Плагин `@tailwindcss/vite`, настроенный в `apps/client/messenger/vite.config.mts`, не всегда подхватывает файлы из `libs/` через граф модулей. Добавьте явные пути к исходникам в `libs/client/shared/src/styles/global.css`:

```css
@import 'tailwindcss';
@source "../../../../../apps/client/**/*.{ts,tsx}";
@source "../../../../../libs/client/**/*.{ts,tsx}";
```

> Пути указываются относительно самого CSS-файла.
> От `libs/client/shared/src/styles/global.css` до корня — **5 уровней вверх** (`../../../../../`).
>
> `styles/` → `src/` → `shared/` → `client/` → `libs/` → **корень**

### VSCode IntelliSense

В Tailwind v4 нет `tailwind.config.js`. Укажите путь к CSS-файлу вручную в расширении `bradlc.vscode-tailwindcss` через `.vscode/settings.json`:

```json
{
  "tailwindCSS.experimental.configFile": "libs/client/shared/src/styles/global.css"
}
```

---

## Vite Dev Proxy

В режиме разработки Vite dev-сервер работает на порту `4200`, а API Gateway — на порту `3000`. Чтобы избежать CORS-проблем и выставить наружу только один порт для туннелирования, Vite проксирует `/api` и `/socket.io` на gateway.

Настройка в `apps/client/messenger/vite.config.mts`:

```ts
server: {
  port: 4200,
  host: true,          // привязка ко всем интерфейсам — требуется для ngrok / LAN-доступа
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
    '/socket.io': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      ws: true,          // проксирование WebSocket-апгрейдов
    },
  },
},
```

### Добавление нового Vite-приложения в монорепозиторий

Если вы создаёте новое frontend-приложение (`npx nx g @nx/react:app`), добавьте такой же блок `proxy` в его `vite.config.mts`. Без него:

- API-запросы будут уходить в `localhost:<порт-нового-приложения>/api` и возвращать 404
- WebSocket-соединения будут падать
- ngrok будет туннелировать только фронтенд, ломая все API-вызовы

### Зачем нужен `host: true`

По умолчанию Vite привязывается только к `localhost`, что блокирует доступ с других машин (включая ngrok). `host: true` заставляет его слушать на `0.0.0.0` — необходимо для любого удалённого доступа.

---

## Переменные окружения (Environment Variables)

Один файл `.env` лежит в **корне репозитория**. Каждый инструмент читает его по-своему.

### Vite (фронтенд)

`apps/client/messenger/vite.config.mts` явно указывает на корень через `envDir`:

```ts
export default defineConfig(() => ({
  envDir: '../../..', // 3 уровня вверх от apps/client/messenger/ → корень
}));
```

Переменные фронтенда должны иметь префикс `VITE_`:

```env
VITE_API_URL=http://localhost:3000/api
```

### NestJS-сервисы (бэкенд)

NestJS читает `process.env.*` напрямую. При запуске через `nx serve` Nx автоматически загружает `.env` из корня — дополнительная настройка не требуется.

### Prisma (миграции и генерация)

Prisma CLI запускается из директории конкретной библиотеки (`cd libs/backend/<service>`), поэтому `dotenv/config` без параметров ищет `.env` в текущей рабочей директории — что может оказаться не тем каталогом.

В каждой библиотеке есть `prisma.config.ts`. В проекте используются два подхода:

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

Работает только если команда запущена из корня репозитория (что и делает `npx nx`).

> **Правило:** при запуске Prisma напрямую из директории библиотеки — используйте Вариант A.
> При запуске через `npx nx run @org/<service>:migrate` — работают оба варианта.

### Сводка

```
Корень репозитория
└── .env                          ← единственный env-файл

apps/client/messenger/
└── vite.config.mts               ← envDir: '../../..'  (3 уровня вверх)

libs/backend/auth/
└── prisma.config.ts              ← __dirname + '../../../.env'  (3 уровня вверх)

libs/backend/user|chat|.../
└── prisma.config.ts              ← import 'dotenv/config'  (работает через nx)
```

---

## MSW в мульти-библиотечном фронтенде (Multi-lib Frontend)

В архитектуре с разбиением на пакеты (`@org/entities-user`, `@org/features-auth` и т.д.), MSW-обработчики живут либо в **выделенной test-utils библиотеке**, либо располагаются рядом с каждым слайсом.

**Подход:** Создайте `libs/client/shared/src/test/handlers/` (или выделенную `libs/client/test-utils/`), которая экспортирует обработчики для всех доменов. Каждая библиотека фичи/сущности, которой нужны моки, импортирует из этого общего места.

**Шаблон для библиотеки-слайса, которому нужен MSW:**

```
libs/client/features/auth/
  src/
    test/
      server.ts          ← setupServer(...handlers)
    test-setup.ts        ← beforeAll/afterEach/afterAll подключение
```

`test-setup.ts` в каждом слайсе:

```ts
// Относительный импорт из общих тестовых утилит
import { server } from '../../../shared/src/test/server';
// Или импорт из пакета test-utils, если доступен

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

> **Примечание:** При разбиении на пакеты нет единого `@org/entities`, который бы агрегировал все API-моки. Если оправдано создание отдельного пакета test-utils, создайте `libs/client/test-utils/` как отдельную Nx-библиотеку и импортируйте её из тестовых файлов слайсов.

**Переопределение обработчика в конкретном тесте:**

```ts
import { HttpResponse, http } from 'msw';

import { server } from '../test/server';

it('обрабатывает ошибку входа', () => {
  server.use(
    http.post('/api/auth/login', () =>
      HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 }),
    ),
  );
  // ... тест
});
```

---

## Тестирование Gateway (Supertest + Замоканые Микросервисы)

Gateway взаимодействует с микросервисами через RabbitMQ `ClientProxy`. Интеграционные тесты используют `NestJS TestingModule` + Supertest с реальным HTTP-слоем, но замокаными клиентами — без RabbitMQ и запущенных сервисов.

**Хелпер настройки:** `apps/backend/gateway/src/test/create-test-app.ts`

```ts
const authClient = { send: jest.fn().mockReturnValue(of({})), emit: jest.fn() };

const moduleRef = await Test.createTestingModule({
  imports: [CoreConfigModule, CoreTokenModule],
  controllers: [AuthGatewayController],
  providers: [
    { provide: AUTH_CLIENT_TOKEN, useValue: authClient },
    // ...остальные замоканые клиенты
  ],
}).compile();
```

**Что это тестирует:**

- HTTP-статус коды, валидацию запросов (ZodValidationPipe), работу с куками
- Поведение Guards и middleware
- Маппинг ошибок из исключений микросервисов в HTTP-ответы

**Что это НЕ тестирует:**

- Бизнес-логику внутри микросервисов (она тестируется в собственных спеках библиотек)
- Реальное состояние базы данных

**POST-обработчики в NestJS по умолчанию возвращают 201** (не 200), если к методу не добавлен `@HttpCode(200)`. Учитывайте это в тестовых утверждениях.
