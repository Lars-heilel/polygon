# Руководство по разработке

## 1. Требования

- Node 22, **только NPM** (`package-lock.json` — источник правды; никогда не добавлять
  `pnpm-lock.yaml` / `yarn.lock` / `bun.lock` — см. `AGENTS.md`).
- Docker Compose для инфры (Postgres, Redis, MinIO, RabbitMQ, Meilisearch, observability).
- Все Nx-задачи запускать через `npm exec nx ...`, никогда через глобальный Nx.

## 2. Почему `apps/` vs `libs/`

- `apps/*` — **деплоебильные точки входа**: тонкие оболочки (Nest `main.ts` + модуль, Vite
  `main.tsx` + роутер/провайдеры). Бизнес-логики здесь нет.
  - Бэкенд: `apps/backend/gateway`, `apps/backend/{auth,user,chat,media,notification,search}-service`.
  - Клиент: `apps/client/messenger` (4200), `apps/client/admin` (4300, base `/admin/`).
- `libs/*` — **переиспользуемые пакеты** с реальной логикой, один npm-пакет на слайс (`@org/*`):
  - `libs/backend/*` — реализации сервисов (контроллеры, сервисы, Prisma-репозитории).
  - `libs/client/*` — FSD-слайсы (`entities`, `features`, `pages/*`, `layouts`, `shared`).
  - `libs/common` — фреймворк-агностик контракты для обеих сторон (см. §3).
  - `libs/backend/core` — общий серверный plumbing (конфиг, Redis, токены, хранилище, гарды).

Правило: **весь код живёт в библиотеках, где это возможно; apps только импортируют и связывают**.
Модули-входы — чистая композиция с `controllers: []`:

```ts
// apps/backend/user-service/src/app/user.module.ts — весь модуль приложения
imports: [ObservabilityModule.forService(SERVICE_NAMES.user), OrgUserModule],
controllers: [],
```

То же на клиенте: в `apps/client/*` только `main.tsx`, роутер и провайдеры.

## 3. `libs/common` — единый источник правды

Всё взаимодействие клиент↔gateway идёт через контракты из `libs/common/src`. **Никаких
захардкоженных URL, строк роутов и самопальных шейпов** ни с одной стороны.

| Контракт | Где | Правило |
|---|---|---|
| HTTP-пути | `constants/routes.ts` → `API_ROUTES` | Корни `@Controller` gateway и каждый вызов `apiFetch`/`authedFetch` на клиенте — только отсюда (например, `API_ROUTES.chats.direct`). Вместо интерполяции строк — функции-билдеры (`byId(id)`, `read(id)`). |
| Клиентские роуты | `constants/routes.ts` → `CLIENT_ROUTES` | Определения React Router и редиректы — только отсюда (гарды в `apps/client/messenger/src/app/router/guards.tsx`). |
| Валидация + типы | `schemas/*` (zod) | **Новые контракты создаются сначала здесь**, как zod-схемы. Типы выводятся (`z.infer`), руками не дублируются. У каждой области — `index.ts` + лежащий рядом `*.spec.ts`. |
| Общие константы | `constants/regex/*`, `constants/*` | Правила паролей, общие енамы — один путь импорта для Nest-DTO и React-форм. |

Принуждение: `scope:client` не может импортировать `scope:backend` и наоборот (границы Nx) —
единственный легальный мост — `type:framework-agnostic` (`libs/common`, core-утилиты).

## 4. Как контракты расходятся по сторонам

Базовая схема в common — это минимальная (серверная) форма. Бэкенд её **оборачивает**,
фронт **расширяет**. Копий-форков схемы не существует — один источник, два адаптера.

**Бэкенд (NestJS).** Nest нужны классы для метаданных `@Body()`/`@Payload()`, поэтому каждая DTO
оборачивает общую схему, а не переописывает поля (`libs/backend/auth/src/dto/register.dto.ts`):

```ts
import { registerSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerSchema) {}
```

Gateway валидирует на входе (`ZodValidationPipe` / `schema.parse(...)`) и шлёт распарсенное
по RMQ; строки RMQ-паттернов при этом живут в `libs/backend/core/src/constants/queues/*`
(транспортная забота, не клиентский контракт).

**Фронт (FSD).** Слайсы импортируют только нужное своему слою из `@org/common`:

```ts
// entities/chat: серверное состояние + пути из common
import { API_ROUTES } from '@org/common';
import type { Chat } from '@org/common';
getChats: () => authedFetch<Chat[]>(API_ROUTES.chats.root),
```

- `entities/*` — API-функции + React Query-хуки + типы из common (без строк роутов).
- `features/*` — мутации/интеракции поверх entity-API.
- `pages/*` + `app/router` — композиция + только `CLIENT_ROUTES`; `API_ROUTES` в компонентах
  страниц запрещены.
- Формы стартуют от общей схемы и расширяют её UI-полями через zod
  (`libs/client/features/auth/src/ui/register-form.tsx`):

```ts
// в common — серверная правда: email + password + username
import { registerSchema } from '@org/common';

const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
```

По сети уходит базовый тип (`use-register.ts`: `z.infer<typeof registerSchema>`) —
`confirmPassword` форму не покидает.

## 5. Стандарты NestJS (бекенд-либы)

Внутри каждой бэкенд-либы одинаковый расклад (`controllers/`, `services/`, `database/`,
`dto/`, `interfaces/`, `guards/`, `strategies/`, `cache/`, `admin/`):

- **Паттерн репозиторий**: `database/prisma/schema.prisma` + `PrismaService` +
  `database/repository/*.prisma.repo.ts`, реализующий интерфейс из `interfaces/`.
  Сервисы зависят от интерфейса, никогда напрямую от Prisma. Ошибки маппятся централизованно
  через `handlePrismaError` (`@org/core`).
- **Без секретов в логах**: хеши токенов, provider id, client metadata не должны попадать в
  `Logger.debug/verbose/log` (конвенция покрыта `auth.prisma.repo.spec.ts` — копировать).
- **Гарды/декораторы** — из `@org/core` или `@org/auth` (`SessionGuard`, `ActiveAccountGuard`,
  `RolesGuard`, `@CurrentUser()`, `@ClientMetadata()`); свои проверки авторизации в каждом
  контроллере не изобретать.
- **Моки переиспользуют тот же DI-механизм**: в тестах подменяются реализации за существующими
  токенами (например, `libs/backend/user/src/Tests/__mocks__/core.mock.ts`), отдельных тестовых
  путей проводки нет.
- **Контроллеры разделены по транспорту**: Gateway — единственная HTTP-поверхность для фронта
  (`@Controller` + `@Get/@Post/...` + Swagger в `apps/backend/gateway/src/controllers/`).
  Контроллеры библиотек HTTP не знают — только `@MessagePattern` (запрос/ответ) и
  `@EventPattern` (fire-and-forget) с `@Payload()`:

```ts
// в либах нет HTTP: чистые RMQ-хендлеры за интерфейсом + DI-токеном
export class UserController implements IUserController {
  constructor(@Inject(USER_SERVICE_TOKEN) private readonly userService: IUserService) {}

  @MessagePattern(USER_PATTERNS.GET_BY_ID)
  getById(@Payload() payload: { id: string }) { ... }

  @EventPattern(USER_EVENTS.REGISTERED)
  handleUserRegistered(@Payload() data: CreateUserEventInput) { ... }
}
```

### 5.1. `@org/core` — заменяемый бэкенд-plumbing

`libs/backend/core/src` (`config`, `redis`, `token`, `encryption`, `email`, `storage`, `search`,
`guards`, `decorators`, `observability`, `prisma`, `constants/queues`, `constants/di`) — переиспользуемая
логика только для бэкенда. Всё потребляется через **интерфейсы + DI-токены**
(`USER_SERVICE_TOKEN`, `USER_CLIENT_TOKEN`, имена очередей), поэтому любой модуль заменяется
(например, MinIO → S3, Meili → стаб в `__mocks__`) без правок потребителей. Новую общую
бэкенд-способность класть в core за токеном — импортировать одну сервисную либу из другой нельзя.

### 5.2. Prisma: один сервис — одна база

Продакшен-правило — отдельная база на сервис. В dev это изолированные базы на одном
Postgres 17 (`infra/db/init` создаёт `polygon_auth/user/chat/media/notification`).
У каждой Prisma-либы одинаковый `prisma.config.ts` — отличается только env-переменная datasource:

```ts
// libs/backend/{auth,user,chat,...}/prisma.config.ts — идентичны, кроме url
dotenv.config({ path: envFile }); // .env / .env.test / .env.production по NODE_ENV
export default defineConfig({
  schema: 'src/database/prisma/schema.prisma',
  migrations: { path: 'src/database/prisma/migrations' },
  datasource: { url: process.env['USER_DATABASE_URL'] }, // AUTH_ / CHAT_ / ... на сервис
});
```

Чеклист нового сервиса: константы очередей + DI-токены в core → `schema.prisma` + такой же
`prisma.config.ts` со своим `*_DATABASE_URL` → база в `infra/db/init` →
тонкая обёртка `apps/backend/*-service` → регистрация RMQ-клиента в Gateway + порт метрик.

## 6. Границы модулей (Nx)

`nx.json → enforceModuleBoundaries` (`allow: []`):

| Тег | Запрещено импортировать |
|---|---|
| `layer:entities`, `layer:features` | `layer:widgets`, `layer:pages`, `layer:layouts` |
| `layer:layouts` | `layer:pages` |
| `layer:shared` | `entities`, `features`, `widgets`, `pages`, `layouts` |
| `scope:client` | `scope:backend` (и наоборот) |
| `type:framework-agnostic` | всё, кроме `type:framework-agnostic` |

Перед запуском тасков — скилл `nx-workspace`; флаги CLI не угадывать.

## 7. Воркспейсы и хойстинг

- Корневой `package.json → workspaces`: `apps/backend/*`, `apps/client/*`, `libs/*`,
  `libs/backend/*`, `libs/client/*`, `features/*`, `pages/*/*`, `entities/*`, `layouts/*`, `widgets/*`.
- Зависимости хойстятся в корневой `node_modules`; у каждого слайса свой `package.json`
  (`@org/*`, теги `layer:*` / `scope:*`), `main: ./src/index.ts` и
  `customConditions: ["@org/source"]` в tsconfig — Vite/Jest резолвят исходники, не `dist`.
- Новый слайс подключать пакетным менеджером воркспейса (NPM) — руками кросс-пакетные пути
  не править, линки не подделывать.

## 8. Env и Prisma-воркфлоу

- `.env` (dev) / `.env.test` / `.env.production` — один набор ключей: `*_DATABASE_URL` ×5,
  `REDIS_*`, `RABBITMQ_*`, `MEILISEARCH_*`, `MINIO_*`, `JWT_*`, OAuth, SMTP, VAPID, URL, observability.
- Один сервис — одна база, паттерн `prisma.config.ts` и `infra/db/init` — см. §5.2.
- `build` зависит от `^build + ^prisma-generate`; входы `prisma-generate` —
  `prisma.config.ts + src/database/prisma/schema.prisma`.

## 9. Частые команды

```bash
npm run dev:docker:up        # инфра (postgres, redis, minio, rabbitmq, meilisearch)
npm run dev:all              # gateway + messenger + admin + 6 сервисов (параллельно)
npm run dev:all:skip-cache   # то же, с чисткой dist и --skip-nx-cache
npm run observability:up     # grafana, prometheus, loki, tempo, alloy + экспортеры

npm exec nx -- run-many --target=build --exclude='@org/*-e2e'
npm exec nx -- run-many --target=test
npm exec nx -- run-many --target=lint
npm exec nx -- affected --target=test
npm run format:check         # nx format:check
npm run demo:build && npm run demo:start   # продоподобный монолит в docker/demo
```

## 10. Фронт — FSD, спроецированный на пакеты

Слои FSD enforced как Nx-пакеты с тегами `layer:*` (§6), а не просто папки. Правило импорта
классическое ([layers](https://feature-sliced.design/docs/reference/layers)): **слайс может
импортировать только слои строго ниже** — `pages → features → entities → shared`.
Кросс-импорты внутри одного слоя — запах: компоновать в верхнем слое (`pages`/`app`), либо
мержить слайсы. Единственное терпимое исключение — сущности, ссылающиеся друг на друга,
явно и по минимуму ([cross-imports](https://feature-sliced.design/docs/guides/issues/cross-imports)).

- **Внутри слайса**: относительные импорты полным путём (`../../lib/utils/cn`).
  Через собственный barrel изнутри не импортировать — будут циклы.
- **Между слайсами**: только абсолютные пакетные импорты (`@org/shared`, `@org/entities-user`)
  через public API слайса (`index.ts`). Deep-импорты во внутренности чужого слайса запрещены
  (граница Nx + правило ревью).
- Новые приложения собираются из существующих слайсов: `messenger` и `admin` делят `@org/shared`,
  `@org/entities-*`, `@org/common` и различаются только роутером/провайдерами/страницами.

### 10.1. Всегда мелкие пакеты: переиспользование между приложениями

Делим на мелкие пакеты **всегда** — не ради сплита, а ради переиспользования:
messenger / admin / будущий market собирают экраны из одних и тех же `entities` / `features` /
`shared`. Отсюда правило: пакет обязан быть **app-agnostic** — ноль импортов из `apps/*`,
только слои ниже + common + собственные deps в своём `package.json`. App-специфика живёт в
`apps/<app>` и `pages/<app>/` и в общие пакеты не протекает. Конвенция «`pages/<app>` —
специфика приложения, всё остальное — universal».

### 10.2. `@org/shared` — переиспользуемый фундамент

Всё переиспользуемое на клиенте — здесь: UI-кит, тема, api/socket/query-примитивы, хуки.
В `package.json` стоит `"sideEffects": false`, чтобы сборка могла вытряхивать barrel.

- **Стили** (`src/styles/`) — фундамент дизайна. `global.css` только реэкспортит в фиксированном
  порядке: `theme.css` (Tailwind v4 `@theme`-токены + `@source` на `apps/client` и `libs/client`,
  чтобы утилиты генерились для всех слайсов), `base.css`, `animations.css`, `vendor.css`, затем
  `components/*.css` (bubbles, media-viewer, chat-header). Приложение получает стили одной строкой:

```css
/* apps/client/messenger/src/app/styles/global.css (в admin так же) */
@import '@org/shared/styles/global.css';
```

CSS уровня приложения — только реэкспорт; стили компонентов — в `shared/styles/components/`,
не россыпью по приложениям, иначе тема разъедется и сломается `@source`-сканирование Tailwind.

- **UI-кит** (`src/ui/<компонент>/`): папка на блок, у каждой свой `index.ts` (button/, input/,
  avatar/, modal/, typography/, …). Блоки — чистый внешний вид, без бизнес-логики: экраны
  собираются как конструктор из готовых деталей. Не строить «станок, который делает детали для
  конструктора» — никаких умных обёрток и сползания логики в кит.
- **Варианты через `cn`** (`src/lib/utils/cn.ts` = `clsx` + `tailwind-merge`): каждый компонент
  складывает `cva`-варианты через `cn(...)` и принимает `className` последним словом для
  оверрайдов в месте вызова (`button.tsx`: `cn(buttonVariants({ variant, size }), className)`).
- **Типографика** (`src/ui/typography/`): `Heading` (уровни 1–6 с респонсив-размерами
  `text-3xl md:text-4xl lg:text-5xl…`, семантический оверрайд через `as`, `srOnly`) и `Text`
  держат все шрифты/размеры десктоп–мобайл в одном месте. Размер текста вне этих компонентов —
  баг: чинить кит, а не инлайнить размеры в местах вызова.
- **Storybook обязателен**: каждый `ui/`-блок идёт с лежащим рядом `*.stories.tsx`
  (`title: 'UI / …'`, `autodocs`, все варианты сторисами — см. `heading.stories.tsx`).
  Сейчас покрытие неполное (12 сторисов; нет у `dropdown`, `modal`, `toast`, `media-viewer`,
  `virtual-feed`, …) — новые компоненты без стори ревью не проходят; недостающие дописывать
  по ходу.

### 10.3. Импорты и кодсплиттинг

Сейчас `@org/shared` отдаёт только два сабпути: `.` (весь barrel) и `./styles/global.css` —
слайсы тянут UI через barrel (`import { Button } from '@org/shared'`). По официальной
[FSD-доке про public API](https://feature-sliced.design/docs/reference/public-api) единый
barrel на `shared/ui` — ровно то, что ломает tree-shaking и раздувает бандлы. Правила:

1. `sideEffects: false` держать на каждом клиентском пакете — только он позволяет Rollup
   выкидывать неиспользуемые реэкспорты barrel в билде.
2. Не импортировать серверно-тяжёлое (socket, query-клиент, audio) через UI-чанки:
   `manualChunks` в `apps/client/messenger/vite.config.mts` (`chunk-virtuoso`, `chunk-auth-vendor`,
   `chunk-socket`) предполагает их разделимость — UI-компонент, импортящий `socket`, молча
   склеивает чанки.
3. Роутовый сплит: страницы — `lazy()`-импорты по слайсам (`@org/pages-*`); в слайсах страниц
   не держать eager-кросс-импортов, чтобы чанк роута оставался худым.
4. Если barrel измеримо раздувает чанк — дробить по рекомендации FSD: `index.ts` на каждый
   `ui/<компонент>` уже есть, добавить subpath-экспорты (`@org/shared/ui/button`) и перевести
   тяжёлых потребителей первыми. Цена dev-сервера (TkDodo) приемлема, выигрыш бандла важнее.

При сомнениях — билд с `rollup-plugin-visualizer` (уже в зависимостях) и смотреть, какой чанк
вырос, до мержа.

### 10.4. Кейс: почему `lazy()` не сплитил markdown

Реальный инцидент (коммиты `efcbba7` → `045884e`, разобран в `REFACTORING_PLAN.md`): рендерер
markdown (`react-markdown` + `react-syntax-highlighter`, ~200 КБ) лежал внутри монолитного
`libs/client/features` рядом со всем остальным. `lazy()` на странице ничего не давал —
сработал только вынос в отдельный пакет. Механика:

1. **Nx-пакеты — не границы бандла.** При `@org/source` Vite собирает исходники либ как плоский
   граф модулей. `package.json` на папке сам по себе ничего не сплитит — решают только рёбра
   импортов. Сплитит не Nx, а Rollup внутри Vite-билда.
2. **Статика всегда бьёт динамику.** Правило Rollup (Vite пишет дословно:
   *«dynamically imported but also statically imported, dynamic import will not move module
   into another chunk»*). Markdown был статически достижим — список сообщений рендерит его
   для каждого сообщения (`message-list.tsx` статически импортировал `MarkdownMessage` из
   barrel `@org/features`) — и любой `lazy()` резолвился в уже собранное.
3. **Lazy на barrel грузит barrel.** Все 9 роутов делали `lazy(() => import('@org/pages'))`,
   а `pages/src/index.ts` реэкспортил auth- и messenger-страницы — Rollup собрал один чанк
   ~430 КБ с формами, virtuoso и всем markdown-стеком.

Отдельный пакет помог не магией, а дисциплиной: один leaf-вход (`@org/features-markdown`),
ноль статических импортёров в eager-графе, единственная ссылка — вызов `lazy()`, плюс
`manualChunks`-пин (`chunk-markdown`). Верни туда один статический импорт — проблема молча
вернётся.

**Deep-импорты ничего не меняют.** Rollup чанкует резолвнутые модули (абсолютные пути файлов),
а не спецификаторы: `import { X } from '@org/features'` (barrel) и
`import { X } from '@org/features/lib/x'` резолвятся в один файл — один модуль. Обход `index.ts`
влияет только на гранулярность tree-shaking, статическое ребро он не рвёт. Лечится только
вырезанием **всех** статических путей из eager-графа до тяжёлого модуля.

Правила, чтобы не повторялось:

1. Тяжёлая зависимость (>30 КБ) → свой пакет со своим public API, не папка внутри общего
   barrel-пакета. (Тяжёлый вендор внутри обычного пакета заражает весь пакет.)
2. `lazy()` — только на leaf-вход пакета, никогда на barrel с чужим кодом.
3. После добавления: grep — статических импортёров тяжёлого пакета в eager-графе ноль;
   чанк есть в билде И в Network грузится только по требованию. Lazy-чанк, который никогда
   не запрашивается в рантайме, означает: содержимое уже в родителе.
4. Тяжёлый вендор пинить через `manualChunks`, чтобы общие внутренности не дублировались
   по асинк-чанкам.
5. Триггер процесса: новая npm-зависимость в клиентском пакете = обязательный вопрос в ревью
   + проверка visualizer/Network. Обычные фичи остаются eager без церемоний.

## 11. Бэкенд-блок: паттерны, события, оркестрация

### 11.1. Patterns vs Events

Всё межсервисное общение — RabbitMQ. Два примитива, путать нельзя:

- **`client.send(PATTERN, payload)` + `@MessagePattern`** — запрос/ответ. Gateway ждёт результат
  и отдаёт его фронту. Так делаются все чтения и команды: `chat.getChats`, `user.getById`,
  `auth.login`, `media.initUpload`, `search.users`.
- **`client.emit(EVENT, payload)` + `@EventPattern`** — fire-and-forget. Отправитель не ждёт,
  ответа нет. Так делаются побочки: `user.registered/updated/deleted` → синхронизация
  Meilisearch-индекса, `send-verification-email`, `send-push`, `push-subscribe/unsubscribe`.

Правила:

1. Нужен результат для HTTP-ответа — только pattern. Не нужен — только event. Event в ответе
   на запрос — баг (gateway вернёт пустоту до того, как работа выполнена).
2. Хендлеры event обязаны переживать повторную доставку (ределивери брокера): идемпотентность
   по ключу сущности, никаких «создать вслепую». Запрос/ответ идемпотентен по построению —
   отправитель повторит `send` сам.
3. Новые pattern/event определяются в `libs/backend/core/src/constants/queues/*.queue.ts`
   (там же DI-токены клиентов в `constants/di/*`), хендлер — в контроллере либы, наружу для
   фронта — только через gateway-контроллер. Сервис, торчащий наружу мимо gateway, запрещён.

### 11.2. Оркестрация живёт в gateway

Сервисы владеют только своим доменом и друг друга не знают: ни синхронных вызовов между
либами, ни импортов чужого домена — только `@org/core` и `@org/common`. Сборка ответов из
нескольких доменов — работа gateway:

- список чатов: `chat.getChats` + обогащение участниками через `user.getManyByIds`;
- профиль: `user.*` + роль из `auth.get-role-by-id`;
- отправка сообщения: `chat.sendMessage` → broadcast по сокетам → push офлайну → инвалидация кэша.

Следствие: новая кросс-доменная фича = новый (или расширенный) gateway-контроллер + готовые
доменные паттерны, а не связи между сервисами. Связность сервисов должна оставаться нулевой —
проверяется тем, что либа собирается и тестируется изолированно, с замоканным core.

### 11.3. Гарды и декораторы: порядок имеет значение

Цепочка на gateway-контроллерах (снаружи внутрь):

1. `ThrottlerGuard` (глобально, `APP_GUARD`, 60с/100) — режет флуд до авторизации.
2. `SessionGuard` (или `JwtGuard`) — JWT из `access_token` + существование сессии в Redis.
3. `ActiveAccountGuard` — Redis-маркер `ban:{userId}` → 403 `ACCOUNT_BANNED`.
4. `RolesGuard` + `@Roles(...)` — только там, где нужно (admin).

Данные запроса — через декораторы, не руками: `@CurrentUser()` (JwtPayload),
`@ClientMetadata()` (ip/country/os/browser/device). Проверки авторизации не дублировать
в телах хендлеров — для этого есть слой гардов.

### 11.4. Контракт ошибок

Сервис кидает RPC-ошибку с `{ message, status }`, gateway ловит и перевыбрасывает как
`HttpException(message, status)` — фронт всегда получает нормальный HTTP-статус.
Валидация входа — `ZodValidationPipe` по схемам из common (§4); ошибки валидации маппятся
`ZodValidationExceptionFilter` в 400 с полями. Свои форматы ошибок не изобретать.

## 12. Тестирование и кодстайл (черновик)

**Раскладка — строго по местам, а не «где приткнётся»:**

- Юнит-спека лежит в `__tests__/` рядом с кодом: `controllers/user.controller.ts` →
  `controllers/__tests__/user.controller.spec.ts`. Спеки вперемешку с исходниками запрещены.
- Внутри `__tests__/` — плоский список юнит-спек; интеграционные — в `__tests__/integration/`,
  фикстуры — в `__tests__/fixtures/`.
- Моки — в строчном `__mocks__` рядом с мокаемым (`Tests` с большой буквы и прочие варианты
  запрещены).
- E2E бэкенда — `apps/backend/<name>-e2e` (уже исключены из `test`-таргета в `nx.json`, чтобы
  юнит-прогон их не цеплял). E2E клиента (Playwright) — `apps/client/<app>/e2e`.
- Общие клиентские стабы (`authedFetch`, socket, avatar, modal) — только в
  `apps/client/messenger/src/test-stubs/shared.tsx`; по слайсам копии не растаскивать.
- Пути, вычисляемые от расположения спеки (`__dirname`, `import.meta.url`), при переезде
  правятся руками — механика `../` их не видит (кейс `global-css-contract.spec.ts`).

- **Бэкенд — Jest:** конфиг `jest.config.cts` на приложение + общий `jest.preset.js`; запуск
  `npm exec nx -- run-many --target=test` или `affected`. Сервисы тестируются через интерфейсы
  с моками за DI-токенами (§5); Prisma-репозитории — с мокнутым `PrismaService`.
- **Клиент — Vitest/Jest + стабы:** `test-setup.ts` на либу (`vi.restoreAllMocks`).
  MSW есть в корневых зависимостях, но в клиентском коде не используется — сетевой слой
  мокается стабами `authedFetch`/socket, а не перехватом HTTP.
- **Кодстайл:** Prettier + ESLint (`npm run format:check`, `nx format:write`), TypeScript `strict`
  (`noUnusedLocals` и др. — см. `tsconfig.base.json`). Импорты сортируются
  (`@trivago/prettier-plugin-sort-imports`). Новое без спеки на поведение — на ревью возвращать.

## 13. Логирование (черновик)

- **Бэкенд — Pino** (`nestjs-pino`, `ObservabilityModule.forService(...)` в каждом entry-модуле):
  структурированные JSON-логи, уровни через `LOG_LEVEL`/`LOG_FORMAT`. Логи пошаговые, чтобы было
  видно, где отвалилось: каждая значимая операция пишет `*_requested` → `*_started` →
  `*_done`/`failed` с `eventType` (см. `chat.service.ts`: `message_attachment_access_requested`,
  `media_reference_create_started`, …). Контекст — имя класса (`new Logger(X.name)`).
  Сырые идентификаторы и секреты не логируются никогда — только факты наличия
  (`hasUserId: !!userId`, `hasChatId: !!chatId`), см. §5.
- **Клиент — `frontendLog` / `useLogger` из `@org/shared` по той же схеме** (уровни
  `log/error/warn/debug/verbose`, контекст-имя, цвета в dev). В прод логи не попадают по
  построению: оба хелпера — noop при `import.meta.env.PROD` (проверено в коде), никаких
  рантайм-флагов и ручных `if` в местах вызова.
- Пользователю — `toast`/`Toaster` (sonner) и `FormAlert` для форм; прямых `console.*` в слайсах
  быть не должно, только через логгер. Сбор клиентских логов через gateway (`frontend-error`)
  выпиливаем как оверинжиниринг: лишний трафик без пользы, dev-логов и серверных достаточно.
