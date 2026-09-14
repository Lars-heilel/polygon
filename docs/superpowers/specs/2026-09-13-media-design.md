# SPEC-4 — media-service (файлы, MinIO)

Дата: 2026-09-13. Статус: draft, ждёт ревью.
Четвёртый из шести. Один сервис целиком: prisma → контракты → репозиторий → сервис+Redis → контроллер → фронт.
Общая преамбула типов — см. `2026-09-13-notification-design.md` §0.

## 1. Цель

Файлы с корректным `BigInt`-размером, tight-лимитами путей, индексами под GC и AccessCheck чата.

## 2. Scope / Non-goals

- В скоупе: `File`/`MediaReference` Prisma, `media.service`, `media.controller`,
  gateway `media`-контроллер, фронт-загрузка/аватары/превью.
- Вне скоупа: сами байты в MinIO (инфра), сообщения чата (потребляют `mediaId`).

## 3. Prisma (`libs/backend/media/src/database/prisma/schema.prisma`)

Текущее (факт): `File(id uuid7, bucket, key unique, originalName, mimeType, size Int,
url?, uploaderId?, status PENDING, chatId?, category)`, `MediaReference(id uuid7, fileId,
ownerType[MESSAGE_ATTACHMENT], ownerId, @@unique([ownerType, ownerId]), @@index([fileId]))`.

Дельта:
- ID/даты: `@db.Uuid`, `@db.Timestamptz(3)`. Enum `FileStatus`/`FileCategory` — нативные.
- `bucket @db.VarChar(63)` (S3-лимит), `key @db.VarChar(1024) @unique`,
  `originalName @db.VarChar(255)`, `mimeType @db.VarChar(127)`, `url @db.VarChar(2048)`,
  `uploaderId @db.Uuid?`, `chatId @db.Uuid?`.
- `size Int → BigInt` (zod тоже `bigint`/string-safe — см. §4): `Int` упирается в 2 ГБ,
  +4 байта/строка — осознанная плата.
- Индексы `File`: добавить `@@index([uploaderId])` (квота/список юзера),
  `@@index([chatId, category])` (лента вложений чата), `@@index([status])`
  (GC зависших `PENDING`). Существующий unique по `key` остаётся (идемпотентный confirm).
- `MediaReference`: `ownerId @db.Uuid`, поле `ownerType` при единственном значении
  схлопнуть в факт (оставить колонку, но зафиксировать non-goal расширения без миграции);
  `@@unique([ownerType, ownerId])` + `@@index([fileId])` оставить.
- `@@map("files")` / `@@map("media_references")` (второе уже есть).

## 4. Контракты (`libs/common`)

- `file.schema.ts`: `size` — договориться на `z.bigint()` vs `z.number().int()` + маппинг
  сериализации RMQ/JSON (BigInt не ходит в JSON напрямую — решение фиксируем при реализации:
  wire-format `string`, доменный тип `bigint`); `bucket .max(63)`, `key .max(1024)`,
  `originalName .max(255)`, `mimeType .max(127)`, `url .max(2048).nullable()`.
- `init-upload`/`confirm-upload` схемы: лимиты те же + серверный allowlist mime/category.

## 5. Репозиторий

- `media.prisma.repo.ts`: `createPending` (upsert по `key`), `confirmByKey`, `findById`,
  `listByChat(chatId, category)`, `listStalePending(before)` для GC, `deleteById`.
- Ссылки: `createReference` идемпотентно по `(ownerType, ownerId)`.

## 6. Сервис + Redis

- `media.service`: init → MinIO presigned → confirm → reference; GC `PENDING` старше N часов
  (батчами, с удалением объектов MinIO); access-check для chat (`canAccess(userId, mediaId)`).
- Redis: `media:upload:{key}` EX 1h (защита confirm от повторов/ределивери),
  `media:gc:lock` (SET NX EX 600) для одиночного GC-прохода.

## 7. Контроллеры

- Lib: `@MessagePattern` (`initUpload`, `confirmUpload`, `accessCheck`, `getById`) —
  нужен результат; `@EventPattern` для GC-триггера/удалений.
- Gateway: `POST /media/init`, `POST /media/confirm`, `GET /media/:id` (стрим с
  ETag/Range/cache через MinIO), guards-цепочка стандартная.

## 8. Фронт

- `features-upload-avatar` + вложения сообщений: presigned-флоу, прогресс, ретраи.
  Отдельного тяжёлого рендера в этом спеке нет (markdown-фича выпилена из приложения —
  см. chat-спеку §8); если появится новая client-зависимость >30 КБ — только своим пакетом
  с `lazy()` по правилу DEVELOPMENT §10.4, без статических импортов в eager-граф.

## 9. Тесты

- Unit: repo upsert/confirm идемпотентность, service GC-батчи (мок MinIO/Prisma/Redis).
- Gateway HTTP: supertest с мокнутым RMQ.

## 10. Верификация и rollout

- `npm exec nx -- affected --target=test` из корня, `npm run format:check`,
  проверка чанка visualizer'ом при новых клиентских deps.
- Миграция чистая (дроп разрешён).
