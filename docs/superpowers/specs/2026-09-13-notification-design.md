# SPEC-1 — notification-service (events-only, самый простой)

Дата: 2026-09-13. Статус: draft, ждёт ревью.
Порядок: первый из шести (простое → тяжёлое). Каждый спек — один сервис целиком:
prisma → контракты → репозиторий → сервис+Redis → контроллер → фронт.

## 0. Общая преамбула типов (действует во всех 6 спеках)

- Все PK/FK: `String @db.Uuid @default(uuid(7))`. UUIDv7 = скрытие порядковых ID от
  конкурентной аналитики + time-ordered btree (монотонность → меньше page splits).
  Native `uuid` = 16 байт против 37 байт `TEXT`-UUID (−21 байт/колонка в heap и в каждом индексе).
- Строки: только `Char(n)/VarChar(n)` с tight-лимитом; `TEXT` — только `message.text`
  (chat-спек). Лимит Prisma = тот же `.max(n)` в zod на gateway: режем на границе, до RMQ.
- Даты: `@db.Timestamptz(3)`. Enum: нативные Postgres-enum (4 байта).
- Дроп БД разрешён пользователем: миграции переписываются чисто, без expand-contract/backfill.
- Контракты: новое — сначала zod в `libs/common/src/schemas/*`, backend — `createZodDto`-wrap,
  фронт — `.extend()`; маршруты только через `API_ROUTES`/`CLIENT_ROUTES`. Форков схем нет.
- Слои backend: lib-контроллеры только `@MessagePattern`/`@EventPattern`; HTTP — только Gateway.
  Ошибки сервисов `{ message, status }` → Gateway маппит в `HttpException`. Логи Pino
  `*_requested → *_started → *_done`, без секретов (только `hasX: !!x`).
- Тесты: спеки в `__tests__/` рядом с кодом, моки в `__mocks__`, живых broker/DB/Redis в юнит-прогоне нет.

## 1. Цель

Привести `notification-service` к конвенциям: tight-типы, один лишний unique долой,
идемпотентные event-хендлеры, ноль секретов в логах.

## 2. Scope / Non-goals

- В скоупе: `PushSubscription` Prisma, `push.service`/`notification.service`,
  `push.controller`/`notification.controller` (events), gateway-контроллеры push, фронт-подписка.
- Вне скоупа: mail-шаблоны, VAPID-ключи, чат/поиск/медиа.

## 3. Prisma (`libs/backend/notification/src/database/prisma/schema.prisma`)

Текущее (факт): `id uuid(7)`, `userId String`, `endpoint String`, `p256dh String`,
`auth String`, `@@unique([userId, endpoint])` + `@@unique([endpoint])` + `@@index([userId])`.

Дельта:
- `id String @db.Uuid`, `userId String @db.Uuid`, все даты `@db.Timestamptz(3)`.
- `endpoint @db.VarChar(2048)`, `p256dh @db.VarChar(128)`, `auth @db.VarChar(128)`
  (ключи push фикс. длины: p256dh ~87, auth ~22 — лимит с запасом).
- Убрать `@@unique([userId, endpoint])`: при `@@unique([endpoint])` эндпоинт глобально
  уникален, композит избыточен (два btree вместо одного на каждую вставку).
- Оставить `@@unique([endpoint])` + `@@index([userId])` (веерная рассылка по пользователю).
- `@@map("push_subscriptions")`.

Индексы — обоснование: вставка подписки идёт по `endpoint` (upsert-конфликт),
чтение для отправки — по `userId`. Больше индексов не нужно: таблица узкая, write-heavy.

## 4. Контракты (`libs/common`)

- `push-subscription.schema.ts`: `endpoint: z.url().max(2048)`, `p256dh/auth: z.string().max(128)`,
  `userId: z.uuid()` (принимает v7, `z.uuid()` версийно-агностичен — подтверждено
  `uuidv7-ids.spec.ts`-подходом).
- События `notification.send-push` (`userId/title/body/tag/eventType`): `title .max(128)`,
  `body .max(512)`, `tag .max(128)` — tight-лимиты до RMQ, чтобы в очередь не уходили гиганты.

## 5. Репозиторий

- `push-subscription.prisma.repo.ts`: интерфейс без изменений; внутри — upsert по `endpoint`
  (идемпотентность при повторной подписке/ределивери), `deleteByEndpoint`, `findByUserId`.
- `handlePrismaError` из `@org/core`, повтор подписки = возврат существующей, не 409.

## 6. Сервис + Redis

- `push.service`/`notification.service`: хендлеры `push-subscribe/unsubscribe`, `send-push`
  — идемпотентны по ключу сущности (endpoint / userId+tag), повторная доставка безопасна.
- Redis: новых ключей не вводим (отправка stateless). Если понадобится дедуп ретраев —
  `push:dedup:{userId}:{tag}` EX 300s, зафиксировать в спеке fact'ом при реализации.

## 7. Контроллеры

- Lib: по умолчанию `@EventPattern` (fire-and-forget) — совпадает с текущим кодом
  (`push.controller.ts`, `notification.controller.ts` — только events) и gateway, который
  шлёт через `client.emit` (subscribe/unsubscribe/send-push) и ответа не ждёт.
  `@MessagePattern` НЕ запрещён: по DEVELOPMENT §11.1 выбор примитива диктуется тем,
  нужен ли результат для HTTP-ответа. Если появится чтение с ответом (например, список
  подписок) — это `@MessagePattern` + `client.send`, как положено. Багом было бы наоборот:
  отдавать HTTP-ответ по событию, не дождавшись результата.
- Gateway: тонкие HTTP-обёртки subscribe/unsubscribe через `client.emit` + 202,
  чтение подписок через `client.send` при необходимости.

## 8. Фронт

- Существующий `features-notifications`: подписка/отписка через `API_ROUTES`, без новых роутов.
  Проверка: повторная подписка не плодит записи (ручной кейс + e2e если есть).

## 9. Тесты

- Unit: repo upsert-идемпотентность (мок `PrismaService`), service ределивери-безопасность.
- Gateway HTTP: supertest поверх мокнутых RMQ-клиентов (паттерн `auth.http.spec.ts`).

## 10. Верификация и rollout

- `npm exec nx -- affected --target=test` из корня, `npm run format:check`.
- Миграция: чистая перезапись (дроп разрешён), `prisma migrate deploy` в `docker/demo/start.sh` без изменений.
