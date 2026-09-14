# SPEC-6 — chat-service (тяжёлый: чаты, участники, сообщения, форварды, вложения, чтения)

Дата: 2026-09-13. Статус: draft, ждёт ревью.
Шестой и самый тяжёлый из шести. Один сервис целиком: prisma → контракты → репозиторий →
сервис+Redis → контроллер → фронт (включая сокеты и кэши gateway).
Общая преамбула типов — см. `2026-09-13-notification-design.md` §0.

## 1. Цель

Чат под большую нагрузку записи: `uuid(7)` везде, keyset-пагинация, корректный
идемпотентный send, осознанная денормализация чтений, кэши и realtime без потери порядка.

## 2. Scope / Non-goals

- В скоупе: `Chat/ChatMember/Message/MessageAttachment/MessageForwardContext/MessageDeletion`
  Prisma, `chat.service`, `chat.controller`, gateway `chats`-контроллер + `chat.socket-gateway`
  + `GatewayChatCacheService`, фронт `entities-chat/message`, `features-send-message/chat-socket/
  create-chat/chat-media`, `pages-chat-page/chats-layout`.
- Вне скоупа: байты вложений (media-спека), пуши офлайн-участникам (вызов notification-события),
  поиск по сообщениям.

## 3. Prisma (`libs/backend/chat/src/database/prisma/schema.prisma`)

Текущее (факт): `Chat(id uuid7, type, name?, avatarUrl?, selfOwnerId? unique, lastMessageId?,
lastMessageAt?, @@index([type]), @@index([lastMessageAt]))`,
`ChatMember(chatId, userId, role, joinedAt, lastReadMessageId?, lastReadAt?, @@id([chatId, userId]),
@@index([userId]), @@index([chatId, lastReadAt]))`,
`Message(id uuid() v4!, clientId?, chatId, senderId, type, text?, editedAt?, deletedAt?,
deletedById?, @@index([chatId, createdAt, id]), @@unique([chatId, clientId]), @@index([deletedAt]))`,
`MessageAttachment(id uuid7, messageId, mediaId, *Snapshot, category String!, @@index([messageId]),
@@index([mediaId]))`, `MessageForwardContext(messageId PK, original*Snapshot*, @@index([originalAuthorId]),
@@index([originalChatId]))`, `MessageDeletion(@@id([messageId, userId]), @@index([userId]))`.

Дельта (реализована 2026-09-13 по `schema.spec.ts`, миграции `2026091310573*`):

Гибридная ID-стратегия: пользовательские/внешние ID — `@db.Uuid v7` (скрытие порядка +
btree), **сообщения и их FK — `BigInt @default(autoincrement())`** (самый горячий write-path:
8-байтовый монотонный PK, минимальный PK/FK-индекс). Wire-формат не меняется: репозиторий
отдаёт decimal-строки, фронт/gateway работают со строками как раньше (normalizer и gateway
ответы через zod не валидируют). Полная bigint-адаптация сервисного слоя (трансляция
string↔bigint, `directKey`-генерация, `hasLink`-детект) — задача реализации SPEC-6.

- `Message.id BigInt autoincrement`; BIGINT-FK: `Chat.lastMessageId`, `ChatMember.lastReadMessageId`,
  `MessageAttachment.messageId`, `MessageDeletion.messageId`, `MessageForwardContext.messageId`,
  `MessageForwardContext.originalMessageId`; `fileSizeSnapshot BigInt`.
- UUID: `Chat.id`, `MessageAttachment.id` (`uuid(7)`); UUID-FK: `Message.chatId/senderId/deletedById`,
  `Chat.selfOwnerId`, `ChatMember.chatId/userId`, `MessageForwardContext.originalChatId/originalAuthorId`,
  `MessageAttachment.mediaId` (FK в media `File.id`).
- `Chat.type/Message.type/attachment.category/originalMessageType` — plain `String` (TEXT),
  enum'ы `MessageType/ChatType` из схемы удалены; доменные CHECK — в миграции
  `20260913105734_chat_type_checks`; `enum ChatRole` оставлен нативным.
  TS-код не затронут: все импорты `ChatType/MessageType` идут из `@org/common`, не из Prisma-клиента.
- Новое: `Message.hasLink Boolean @default(false)`, `Chat.directKey String? + @@unique([directKey])`
  (детерминированный ключ DIRECT-чата; генерация — SPEC-6). `Chat.name VarChar(128)`,
  `avatarUrl VarChar(2048)`, `clientId VarChar(128)?`, `text @db.Text`, снапшоты — tight-VarChar.
- Индексы: `Chat @@index([type]) + @@index([lastMessageAt, id])`,
  `ChatMember @@index([userId]) + @@index([userId, chatId]) + @@index([chatId, lastReadAt])`,
  `Message @@index([chatId, createdAt, id])` (keyset) + `@@index([senderId])` + `@@index([deletedAt])`.
- `@@unique([chatId, clientId])` оставлен как был; замена на частичный unique
  `WHERE clientId IS NOT NULL` — задача SPEC-6.
- `lastMessageId/lastMessageAt` — осознанная денорм. (сортировка списка без джойна);
  инвариант: обновляется только в `sendMessage`-транзакции (SPEC-6).
- Все таблицы `@@map` snake_case, все даты `@db.Timestamptz(3)`.

## 4. Контракты (`libs/common`)

- `chat/chat-member/message/send-message/edit/delete/forward/read/create-direct/chat-media`-схемы:
  ID — `z.uuid()`, `text .max(4096)`, `name .max(128)`, превью/снапшоты — лимиты из §3,
  `clientId .uuid().max(128)` (идемпотентный ключ повторной отправки при ретраях сети).
- Курсор пагинации: opaque `(createdAt, id)` — наружу как единый `cursor: z.string().max(128)`,
  парсинг на gateway (сырые `createdAt/id` наружу не светим сверх необходимого).

## 5. Репозиторий

- `chat.prisma.repo.ts`: `listChatsForUser(userId)` — один запрос через members+join с keyset;
  `sendMessage` — транзакция (insert message + attachments + forwardContext + update
  `Chat.lastMessage*`); `edit/delete` (soft: `editedAt/deletedAt` + per-user `MessageDeletion`);
  `markRead(chatId, userId, messageId)`; `getMessages(chatId, cursor, limit)` keyset
  `(createdAt, id)`; `addMember/removeMember`.
- Все чтения списка/истории — только через индексные пути §3 (проверяется `EXPLAIN` при ревью).

## 6. Сервис + Redis + сокеты

- `chat.service`: membership-check перед каждой операцией; `message_attachment_access` —
  проверка через media-спеку; step-логи `eventType` (`message_send_requested → _started → _done`).
- Redis (существующие + фиксация): `presence:{userId}` EX 120, `typing:{chat}:{user}` EX 3s,
  gateway-кэши `chat:list:{userId}` 30s + `chat:msgs:{chatId}:*` 60s с `X-Cache` HIT/MISS
  и silent-fallback; инвалидация обоих на send/edit/delete; login-attempts не трогаем (auth).
- `chat.socket-gateway`: connect (JWT из cookie + бан-чек) → join `chat:{id}` → `message:send`
  (zod → membership → `chat.sendMessage` → `to(chat).emit('message:new')` → пуш офлайн через
  `notification.send-push` → инвалидация кэша); `user:typing`, `message:updated/deleted`,
  `user:online/offline`, `message:send:error`.

## 7. Контроллеры

- Lib: `@MessagePattern` (getChats, getMessages, send/edit/delete/forward, members, markRead) —
  нужен результат; `@EventPattern` — только чистые side-effects.
- Gateway `chats`-контроллер: оркестрация `chat.getChats + user.getManyByIds` (обогащение
  участников), guards-цепочка стандартная, `ZodValidationPipe` на границе.

## 8. Фронт: дельта-синхронизация + оптимизация чтения/записи

Факт по коду: `message:new` на клиенте только скроллит (`virtual-message-list.tsx:209`) и
дебаунсит markRead (`use-chat-socket.ts:60`); хендлеров `message:updated/deleted` на клиенте
нет — правки/удаления с других устройств видны только после рефетча. Отдельного
`chat-socket-manager` в коде нет. Дельта-эндпоинта (`since`) нет — только полные cursor-страницы.
`messages-flat` дублирует infinite `['messages']`, а каждая мутация инвалидирует весь `['chats']`
(`message.api.ts:88-89,103-104,115-117`) — полный рефетч списка на каждый edit/delete/forward.

Дельта-синхронизация (backend + фронт):
- Новый `GET messages?since=<ts>&sinceId=<id>` (gateway → `chat.getMessagesDelta`):
  возвращает только изменённые после чекпоинта (созданные/отредактированные + `deletedIds`).
  Лимиты: `limit .max(100)`, checkpoint — opaque cursor как в §4.
- Reconnect-флоу: на socket `connect` клиент шлёт последний известный `(lastMessageAt, lastId)`
  открытого чата → delta-fetch → патч страниц (новые — вставка со сверкой по `clientId`,
  правки — существующий `updateMessageInPages`, удаления — `removeMessageFromPages`)
  вместо полной инвалидации.
- Подписать клиент на `message:updated/deleted` (сервер их уже эмитит): патч тех же хелперов,
  без рефетча страниц.

Оптимизация чтения:
- Убрать дублирующий `messages-flat` запрос (потребителей перевести на select из infinite
  `['messages', chatId]`).
- Запретить полную инвалидацию `['chats']` на edit/delete/forward: вместо неё точечный патч
  превью/unread конкретного чата; полный рефетч — только на send в чужой чат и membership-изменения.

Оптимизация записи:
- Оптимистичная отправка уже есть (`client:`-заглушка + `cancelQueries`/snapshot/rollback в
  `use-send-message.ts`) — оставить; добавить сверку эха сервера по `clientId`
  (замена заглушки реальным сообщением при `message:new`/HTTP-подтверждении, без рефетча).
- `clientId` генерируется клиентом (`crypto.randomUUID()` достаточно — уникальность в пределах
  `(chatId, clientId)` даёт частичный unique-индекс из §3, v7 клиенту не нужен).

Чистка: markdown-фича выпилена из приложения (директории `libs/client/features/markdown-message`
нет на диске) — удалить остаточный `'markdown'` из `MessageKind` (`message.types.ts:6`) и
протухшую workspace-запись `@org/features-markdown` в `package-lock.json`. Правило
«heavy-dep >30 КБ → свой пакет + `lazy()`» (DEVELOPMENT §10.4) действует дальше, но применяется
к будущим зависимостям, а не к markdown.

## 9. Тесты

- Unit: repo keyset-порядок при равных `createdAt`, идемпотентный send по `clientId`
  (частичный unique), транзакция `lastMessage*`, markRead, membership-deny.
- Service/socket: broadcast + инвалидация кэша + офлайн-пуш (моки RMQ/Redis).
- Gateway HTTP: supertest с мокнутым RMQ.

## 10. Верификация и rollout

- `npm exec nx -- affected --target=test` из корня, `npm run format:check`,
  `EXPLAIN` горячих запросов, visualizer/Network-проверка чанков.
- Миграция чистая (дроп разрешён); частичный unique — raw-SQL в миграции.
