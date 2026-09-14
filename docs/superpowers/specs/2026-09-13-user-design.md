# SPEC-3 — user-service (профили)

Дата: 2026-09-13. Статус: draft, ждёт ревью.
Третий из шести. Один сервис целиком: prisma → контракты → репозиторий → сервис+Redis → контроллер → фронт.
Общая преамбула типов — см. `2026-09-13-notification-design.md` §0.

## 1. Цель

Профили с tight-типами под запись, корректные индексы чтения, чистые контракты пользователя.

## 2. Scope / Non-goals

- В скоупе: `User` Prisma, `user.service`, `user.controller`, gateway `users`-контроллер,
  `entities-user` + `pages-profile*` + `features-user-profile`.
- Вне скоупа: credentials/роли (auth-спека), поиск (search-спека, потребляет события отсюда).

## 3. Prisma (`libs/backend/user/src/database/prisma/schema.prisma`)

Текущее (факт): `id uuid(7)`, `email unique`, `name`, `displayName?`, `avatarUrl?`, `bio?`,
`@@index([name])`.

Дельта:
- `id String @db.Uuid` **без `@default`** (реализовано 2026-09-13): id приходят из
  `user.registered`-событий (id auth-service, UUIDv7), локальная генерация запрещена спекой —
  иначе форк id-пространства.
- `email @db.VarChar(254) @unique` (RFC-максимум; короткий btree-ключ).
- `name @db.VarChar(32)`, `displayName @db.VarChar(64)`, `avatarUrl @db.VarChar(2048)`,
  `bio @db.VarChar(500)` (inline, без TOAST).
- Индексы: оставить `@@index([name])` (сортировка/список), добавить `@@index([displayName])`
  только если появится чтение по нему — по умолчанию НЕ добавляем (поиск идёт через Meili,
  лишний btree на write-path не нужен). Trigram-индекс осознанно не заводим.
- `@@map("users")`.

Нормализация: таблица уже нормализована; денормализации нет и не вводим.

## 4. Контракты (`libs/common`)

- `user.schema.ts`: `name .min(2).max(32)`, `displayName .max(64)`, `avatarUrl .url().max(2048)`,
  `bio .max(500)`, `email .email().max(254)`, `id: z.uuid()` (v7-совместимо).
- `update-user.schema.ts`: те же `.max()`; пустые строки нормализуем в `null` на gateway.
- `create-user-event.schema.ts` (события `user.registered/updated/deleted`): поля в тех же лимитах,
  чтобы search-синк получал уже обрезанные значения.
- `user-select.ts`: select-наборы для gateway-обогащения (chat list, profile) — без `email`
  в публичных выборках.

## 5. Репозиторий

- `user.prisma.repo.ts`: интерфейс без изменений; `create` идемпотентен по `id` (событие
  регистрации может прийти повторно), `updateById`, `findById`, `findManyByIds` (батч для
  gateway-обогащения chat list — один запрос вместо N).
- `handlePrismaError` из `@org/core`.

## 6. Сервис + Redis

- `user.service`: CRUD + эмиты `user.registered/updated/deleted` (fire-and-forget через RMQ events).
- Redis: кэш профиля `user:profile:{id}` EX 60s с инвалидацией на update/delete — единственный
  новый ключ; промах = чтение из БД, Redis-даун = silent fallback (паттерн gateway chat-cache).

## 7. Контроллеры

- Lib: `@MessagePattern` (`GET_BY_ID`, `GET_MANY`, `UPDATE`) — нужен результат;
  `@EventPattern` — только если понадобится inbound-синк (по умолчанию нет).
- Gateway `users`-контроллер: стандартная guards-цепочка, `GET /users/:id` + `PATCH /users/me`,
  обогащение профиля ролью из auth (`profile = user.* + auth.get-role-by-id`) — оркестрация
  только здесь, не в сервисе.

## 8. Фронт

- `entities-user`: API-функции + React Query хуки через `API_ROUTES`, ключ кэша `['user', id]`.
- `features-user-profile` / `pages-profile-edit`: формы от `updateUserSchema` (общий контракт),
  UI-only поля через `.extend()`, наружу уходит базовый тип.
- Аватар: загрузка через media-спеку, сюда приходит готовый `avatarUrl`.

## 9. Тесты

- Unit: repo `findManyByIds` батчинг, service эмит событий, кэш hit/miss/invalidate (мок Redis).
- Gateway HTTP: supertest с мокнутым RMQ (успех `of(...)` / RPC-ошибка `throwError(...)`).

## 10. Верификация и rollout

- `npm exec nx -- affected --target=test` из корня, `npm run format:check`.
- Миграция чистая (дроп разрешён); после — реиндекс search (SPEC-2).
