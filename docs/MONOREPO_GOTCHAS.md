# Подводные камни монорепо

Неочевидное, о которое уже спотыкались. Прочитать до того, как чинить сборку «в лоб».

## 1. Tailwind v4 `@source`: стили слайсов не генерируются сами

Tailwind v4 сканирует только файлы, покрытые `@source`. Единая точка — `theme.css` в shared
(`libs/client/shared/src/styles/theme.css`):

```css
@import 'tailwindcss';
@source "../../../../../apps/client/**/*.{ts,tsx}";
@source "../../../../../libs/client/**/*.{ts,tsx}";
```

Симптом: классы из нового слайса молча не работают (в dev и в build). Лечение — не копировать
CSS по приложениям, а проверить, что слайс попадает под эти два `@source`. Стили приложений —
только реэкспорт shared (см. DEVELOPMENT §10.1).

## 2. Vite dev-proxy и `VITE_*` из process.env

Клиент ходит в gateway через proxy (`apps/client/messenger/vite.config.mts`):

- `/api → http://localhost:3000`, `/socket.io → http://localhost:3000` с `ws: true`
  (в `server` и в `preview` — оба места).

Нюанс: Nx грузит корневой `.env` в `process.env` до Vite, а Vite отдаёт приоритет `process.env`
перед файлом окружения по `mode` — в итоге `.env.production` не перебивает `.env`. Поэтому
в конфиге явно удаляются `VITE_API_URL` / `VITE_SOCKET_URL`:

```ts
delete process.env['VITE_API_URL'];
delete process.env['VITE_SOCKET_URL'];
```

Симптом: прод-превью стучится в `localhost:3000`. Не чинить URL руками — проверить этот блок
и `envDir: repoRoot`.

## 3. Env валидируется схемой: запуск не из корня падает

`env.schema.ts` валидирует окружение строго (порты — числа, URL — строки). dotenv ищет `.env`
от cwd. Запуск jest/vitest с cwd внутри либы → `.env` не найден → стена ошибок вида:

```
CHAT_PORT: Invalid input: expected number, received NaN
APP_URL: Invalid input: expected string, received undefined
```

Это не баг кода. Тесты гонять только через nx из корня (`npm exec nx -- test ...`), прямой
`npx jest` внутри пакета — лишь с выставленным cwd в корень. То же касается `prisma.config.ts`:
он резолвит `.env` / `.env.test` / `.env.production` по `NODE_ENV` от корня либы
(`join(__dirname, '../../../...')`) — перекладывать `__dirname`-пути при рефакторинге нельзя.

## 4. MSW в зависимостях, но в клиенте не используется

`msw` висит в корневом `package.json`, однако ни одного хендлера/воркера в `apps/client` и
`libs/client` нет — и это намеренно. Сетевой слой мокается стабами `authedFetch`/socket
(`test-stubs/shared.tsx`), а не перехватом HTTP. Не заводить MSW-хендлеры «по привычке»:
два механизма моков сети в одном репо разъедутся при первом же рефакторе API-клиента.

## 5. Gateway-тесты: supertest поверх мокнутых RMQ-клиентов

Паттерн (`auth.http.spec.ts` и соседи): поднимается настоящее Nest-приложение через
`@nestjs/testing` + `supertest`, а RMQ-клиенты подменяются моками `{ send: jest.fn() }`
(`of(...)` на успех, `throwError(...)` на RPC-ошибку). Фильтры (`GatewayHttpExceptionFilter`,
`ZodValidationExceptionFilter`) и cookie-парсер — настоящие, поэтому спеки проверяют реальный
HTTP-контракт: статусы, `set-cookie`, тело 400 с полями.

Правила:

- Мокать границу транспорта (ClientProxy), а не контроллер — иначе тестируется мок, а не код.
- Живые брокер/БД/Redis в юнит-прогоне запрещены; для этого есть `*-e2e` проекты, исключённые
  из `test`-таргета в `nx.json`.
- Куки в supertest проверять через `set-cookie`-хелпер (пример — `getSetCookieHeaders`),
  а не строковым `toContain`: атрибуты `HttpOnly/SameSite` важны.
