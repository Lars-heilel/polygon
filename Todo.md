# Polygon — Roadmap & Architecture Notes

---

## Порядок реализации (от простого к сложному)

| # | Фича | Сложность | Что трогаем |
|---|------|-----------|-------------|
| 1 | **Emoji picker** | 🟢 Тривиально | Только фронт. `emoji-mart` → вставка unicode в textarea |
| 2 | **Markdown форматирование** | 🟢 Тривиально | Только фронт. `react-markdown` + `shiki` для рендера |
| 3 | **Soft delete middleware** | 🟢 Просто | Prisma `$use` middleware в каждом сервисе + `deletedAt` в схемах |
| 4 | **Редактирование / удаление сообщений** | 🟢 Просто | PATCH/DELETE эндпоинты + WS события `message:updated` / `message:deleted` |
| 5 | **Курсорная пагинация сообщений** | 🟡 Средне | Переписать `getMessages` на cursor, фронт infinite scroll вверх |
| 6 | **Виртуализация списков** | 🟡 Средне | Только фронт. `@tanstack/react-virtual` в чате и сайдбаре |
| 7 | **Аватар пользователя** | 🟡 Средне | media-service upload → S3/MinIO → `avatarUrl` в профиле |
| 8 | **Блокировка пользователей** | 🟡 Средне | Новая Prisma модель `BlockedUser` + guards в chat/user сервисах |
| 9 | **Read status (непрочитанные)** | 🟡 Средне | `lastReadMessageId` на ChatMember + счётчик + WS событие |
| 10 | **Файлы в чате** | 🟡 Средне | media-service + расширить `Message` (type FILE/IMAGE) |
| 11 | **Реакции на сообщения** | 🟡 Средне | Новая Prisma модель `Reaction` + WS `reaction:added` / `reaction:removed` |
| 12 | **Presence + уведомления** | 🔴 Сложно | Redis TTL heartbeat, PresenceService, NotificationGateway, RMQ pipeline |
| 13 | **Групповые чаты** | 🔴 Сложно | Новый тип чата, роли (owner/admin/member), инвайт система, права |
| 14 | **WebRTC 1-на-1 звонки** | 🔴 Сложно | Сигнализация в gateway + WebRTC API на фронте (offer/answer/ICE) |
| 15 | **Система дружбы** | 🔴 Сложно | Новый сервис или расширение user-service, заявки, статусы, уведомления |
| 16 | **Групповые звонки** | 🔥 Очень сложно | Mesh координация в gateway, динамический join/leave, N×(N-1) соединений |

---

## Сквозные требования

### Soft Delete

Применяется ко всем основным сущностям. Удалённые записи не удаляются физически — скрываются через фильтр.

```prisma
// Паттерн для всех моделей:
model Example {
  deletedAt DateTime?   // null = активна, дата = удалена
}
```

| Модель | Поведение при удалении |
|--------|------------------------|
| `Message` | `deletedAt` = now. Клиент показывает "Сообщение удалено", контент скрыт |
| `User` | `deletedAt` = now. Профиль недоступен, сообщения показывают "Удалённый пользователь" |
| `Chat` | Soft delete для каждого участника отдельно (`ChatMember.deletedAt`) — покидание чата |
| `BlockedUser` | Hard delete — блокировка просто снимается |
| `File` (media) | `deletedAt` = now + async job удаляет файл из S3 |

**Реализация в Prisma:**
```prisma
// Во всех запросах добавлять фильтр:
where: { deletedAt: null }

// Prisma middleware в каждом сервисе — глобальный фильтр:
prisma.$use(async (params, next) => {
  if (params.action === 'findMany' || params.action === 'findFirst') {
    params.args.where = { ...params.args.where, deletedAt: null };
  }
  return next(params);
});
```

---

## Блок 1: Presence + Real-time Notifications

> **Статус:** Спроектирован, не реализован  
> **Зависимости:** Redis (уже в стеке), RabbitMQ (уже в стеке)

### Что строим

| Фича | Описание |
|------|----------|
| Онлайн-статус | Виден всем пользователям |
| Multi-device | Один юзер — несколько вкладок/устройств одновременно |
| Device tracking | Определяем устройство через User-Agent |
| AFK-статус | Авто-переход в `away` при неактивности > 5 мин |
| Push-уведомления | Новое сообщение, инвайт в чат — real-time доставка |

---

### PresenceService (gateway)

Хранит сессии в Redis. TTL-based: ключ существует → юзер онлайн.

```
Redis структура:
  presence:{userId}               → STRING  TTL 30s  (факт онлайна)
  presence:{userId}:sockets       → HASH    { socketId → { ua, connectedAt } }
  presence:{userId}:status        → STRING  "online" | "away"
```

**Жизненный цикл сессии:**

```
handleConnection(socket)
  ├── verifyToken(cookie) → userId
  ├── Redis: SET presence:{userId} 1 EX 30
  ├── Redis: HSET presence:{userId}:sockets {socketId} { ua, connectedAt }
  ├── socket.join(`user:${userId}`)        // персональная комната для пушей
  └── server.emit('presence:online', userId)  // всем онлайн-пользователям

@SubscribeMessage('presence:ping')         // клиент шлёт каждые 20с
  ├── Redis: EXPIRE presence:{userId} 30   // обновляем TTL
  └── если last_active > 5 мин → SET presence:{userId}:status "away"

handleDisconnect(socket)
  ├── Redis: HDEL presence:{userId}:sockets {socketId}
  └── если сокетов больше нет:
        ├── Redis: DEL presence:{userId}, presence:{userId}:status
        └── server.emit('presence:offline', userId)

@SubscribeMessage('presence:get_online')   // запрос при первом входе
  └── return [userId, userId, ...]         // список всех онлайн-юзеров
```

---

### Push-уведомления — поток данных

Маршрут: **сервис → notification-service → gateway → клиент**

```
chat-service
  └── после send_message:
        chatClient.emit('notification.new_message', {
          userId: receiverId,
          chatId,
          messagePreview: text.slice(0, 100),
        })

notification-service
  └── @EventPattern('notification.new_message')
        gatewayPushClient.emit('push.deliver', {
          userId,
          event: 'notification:new_message',
          payload: { chatId, messagePreview },
        })

gateway — NotificationGateway
  └── @EventPattern('push.deliver')
        server.to(`user:${userId}`).emit(event, payload)
        // user:{userId} — комната, в которую джойнятся ВСЕ сокеты юзера
        // → уведомление придёт на все устройства одновременно
```

**Почему через `user:${userId}` комнату, а не перебор сокетов:**  
Socket.IO сам знает все сокеты в комнате — не нужно вручную итерировать `PresenceService.getSockets()`.

---

### Что и где меняем

```
@org/core
  ├── constants/queues/notification.queue.ts
  │     └── добавить: GATEWAY_PUSH_QUEUE = 'gateway_push'
  │     └── добавить: NOTIFICATION_EVENTS.NEW_MESSAGE, NOTIFICATION_EVENTS.CHAT_INVITE
  └── constants/di/notification.di.ts
        └── добавить: GATEWAY_PUSH_CLIENT_TOKEN

gateway
  ├── services/presence.service.ts       [NEW] Redis-based presence
  ├── gateways/chat.socket-gateway.ts    [MOD] handleConnection/Disconnect + presence:ping
  ├── gateways/notification.gateway.ts   [NEW] RMQ consumer → server.to(room).emit
  └── app/gateway.module.ts              [MOD] подключить Redis, gateway_push RMQ consumer

notification-service
  └── lib/notification.service.ts        [MOD] новые EventPattern: new_message, chat_invite

chat-service
  └── services/chat.service.ts           [MOD] emit notification.new_message после send_message
```

---

## Блок 2: WebRTC — 1-на-1 звонки (сигнализация)

> **Статус:** Спроектирован, не реализован  
> **Подход:** Mesh P2P, gateway только relay. Медиа — напрямую между клиентами.

### Что строим

| Фича | Описание |
|------|----------|
| 1-на-1 звонки | Аудио и видео |
| История звонков | Сообщение в чате с `type: CALL` и `duration` |
| Busy / Unavailable | Проверка онлайна и занятости перед звонком |
| Disconnect handling | Авто-завершение при потере соединения |

---

### Поток звонка

```
1. ИНИЦИАЦИЯ
   caller → webrtc:call { chatId, calleeId }
   gateway → проверяет: онлайн? занят?
   gateway → user:{calleeId}.emit('webrtc:incoming', { callId, callerId })

2. ОТВЕТ
   callee → webrtc:answer { callId, accepted: true | false }
   false  → caller.emit('webrtc:declined')  + activeCalls.delete
   true   → caller.emit('webrtc:accepted')  → переход к SDP

3. СИГНАЛИЗАЦИЯ
   caller → webrtc:offer { callId, sdp }       → callee
   callee → webrtc:answer-sdp { callId, sdp }  → caller
   either → webrtc:ice-candidate { callId, candidate } → other party

4. ЗАВЕРШЕНИЕ
   either → webrtc:hangup { callId }
   gateway → other party.emit('webrtc:hangup')
   gateway → chat-service: call_ended { chatId, duration, callerId }
   chat-service → Message { type: CALL, duration }
```

### Edge cases

| Ситуация | Обработка |
|----------|-----------|
| Callee офлайн | `PresenceService.isOnline()` → emit `webrtc:unavailable` |
| Callee занят | `activeCalls` проверяем → emit `webrtc:busy` |
| Disconnect во время звонка | `handleDisconnect` → hangup + сохранить в чат |
| Нет ответа (таймаут) | Клиент через 30с emit `webrtc:hangup` |

### Схема сообщения (Prisma)

```prisma
model Message {
  type     MessageType @default(TEXT)
  duration Int?        // секунды, только для CALL
}

enum MessageType { TEXT CALL }
```

### Что и где меняем

```
gateway/gateways/webrtc.gateway.ts     [NEW] вся сигнализация + activeCalls Map
@org/core  chat patterns               [MOD] добавить CHAT_PATTERNS.CALL_ENDED
@org/chat  prisma/schema.prisma        [MOD] MessageType enum + duration
chat-service                           [MOD] обработчик call_ended → saveMessage
```

---

## Блок 3: User Profile — расширение

> **Статус:** Планируется, не спроектирован

### Что добавляем к текущему GET /users/:id / PATCH /users/me

| Фича | Описание | Сервис |
|------|----------|--------|
| **Блокировка** | Блокировать/разблокировать пользователя. Заблокированный не может писать и видеть профиль | user-service |
| **Real-time обновление профиля** | При `PATCH /users/me` → WS событие `user:updated { userId, changes }` → все кто смотрит профиль получают обновление | gateway |
| **Просмотр профиля другого юзера** | Уже есть `GET /users/:id`, но нужен экран на фронте с онлайн-статусом, общими чатами, кнопкой "написать" | фронт + Блок 1 |
| **Онлайн-статус на профиле** | Показывать `online` / `away` / `offline` + "последний раз онлайн X мин назад" | Блок 1 |
| **С какого устройства** | Список активных сессий юзера (только своих) — Chrome / Windows, Safari / iOS и т.д. | Блок 1 |

### Блокировка — схема

```
PATCH /users/:id/block   → user-service: BlockedUser { blockerId, blockedId }
PATCH /users/:id/unblock → user-service: delete BlockedUser

Эффекты:
  - chat-service.sendMessage   → проверяет блок → 403
  - GET /users/:id             → если заблокирован → скрытый профиль
  - chat-service.createDirect  → если блок → нельзя создать чат
```

```prisma
model BlockedUser {
  id        String   @id @default(cuid())
  blockerId String
  blockedId String
  createdAt DateTime @default(now())

  @@unique([blockerId, blockedId])
}
```

---

## Блок 4: Чаты — недостающий функционал

> **Статус:** Планируется, не спроектирован

### Групповые чаты

| Фича | Описание |
|------|----------|
| Создание группового чата | `POST /chats/group { name, memberIds[] }` |
| Инвайт участника | `POST /chats/:id/members { userId }` → уведомление через Блок 1 |
| Удаление участника / выход | `DELETE /chats/:id/members/:userId` |
| Роли | owner / admin / member (минимум owner для удаления чата) |

### Сообщения

| Фича | Описание |
|------|----------|
| Редактирование | `PATCH /chats/:id/messages/:msgId` → WS `message:updated` |
| Удаление | `DELETE /chats/:id/messages/:msgId` → WS `message:deleted` |
| Read status | `POST /chats/:id/messages/read { lastReadMessageId }` → счётчик непрочитанных |
| Реакции | `POST /chats/:id/messages/:msgId/reactions { emoji }` |

### ⚠️ Курсорная пагинация сообщений (важно)

Текущая пагинация `skip/take` — медленная на больших объёмах. Нужна курсорная.

```
// Текущая (плохо)
GET /chats/:id/messages?skip=200&take=50

// Нужно (курсор = ID последнего загруженного сообщения)
GET /chats/:id/messages?cursor=msg_abc123&take=50&direction=before

// Prisma:
findMany({
  take: -50,                          // 50 записей ДО курсора
  cursor: { id: cursor },
  orderBy: { createdAt: 'desc' },
})
```

Это разблокирует **infinite scroll** на фронте — подгружаем старые сообщения при скролле вверх без деградации производительности.

### Виртуализация списков (фронт)

| Список | Библиотека | Важность |
|--------|-----------|----------|
| Сообщения в чате | `@tanstack/react-virtual` | 🔴 Критично |
| Список чатов в сайдбаре | `@tanstack/react-virtual` | 🟡 Средне |
| Поиск пользователей | Виртуализация не нужна (лимит 20) | — |

---

## Блок 5: Медиа — файлы, аватары, вложения

> **Статус:** Планируется, не спроектирован  
> **Инфраструктура:** media-service существует но пустой. Нужен S3-совместимый storage (MinIO для dev, S3 для prod)

### Что строим

| Фича | Описание |
|------|----------|
| Аватар пользователя | Upload → resize → S3 → URL в профиле |
| Файлы в чате | Изображения, документы (PDF, docx и т.д.) |
| Превью изображений | Генерация thumbnail при загрузке |
| Ограничения | Макс размер файла, разрешённые MIME-типы |

### Поток загрузки файла

```
1. Клиент → POST /media/upload { file, context: 'avatar' | 'chat' }
   gateway → media-service (multipart через RMQ или HTTP напрямую)

2. media-service
   ├── валидация (MIME, размер)
   ├── если изображение → sharp: resize + webp
   ├── upload → S3/MinIO
   └── return { url, key, mimeType, size }

3. Для аватара:
   PATCH /users/me { avatarUrl }

4. Для чата:
   message:send { chatId, fileUrl, fileName, mimeType, type: 'FILE' }
   → Message { type: FILE, fileUrl, fileName, mimeType }
```

### Схема сообщения (расширение Блока 2)

```prisma
enum MessageType { TEXT CALL FILE IMAGE }

model Message {
  type      MessageType @default(TEXT)
  fileUrl   String?
  fileName  String?
  mimeType  String?
  fileSize  Int?        // bytes
  duration  Int?        // для CALL
}
```

### Что и где меняем

```
media-service                          [MOD] upload handler, S3 client, sharp resize
@org/core  media patterns              [NEW] MEDIA_PATTERNS.UPLOAD
gateway    controllers/media.controller [NEW] POST /media/upload
@org/chat  prisma/schema.prisma        [MOD] расширить MessageType + file поля
```

---

## Блок 6: Форматирование сообщений + Emoji

> **Статус:** Планируется, не спроектирован  
> **Важно:** Бэкенд хранит **сырой текст** (markdown). Рендеринг — только фронт.

### Форматирование (Markdown subset)

| Синтаксис | Результат |
|-----------|-----------|
| `` `код` `` | инлайн код |
| ` ```ts\nкод\n``` ` | блок кода с подсветкой синтаксиса |
| `**жирный**` | **жирный** |
| `_курсив_` | _курсив_ |
| `~~зачёркнутый~~` | ~~зачёркнутый~~ |

**Библиотеки (фронт):**
- `react-markdown` + `remark-gfm` — рендер markdown
- `react-syntax-highlighter` или `shiki` — подсветка кода в блоках
- Бэкенд: хранит текст as-is, никакой обработки

### Emoji

| Фича | Реализация |
|------|-----------|
| Emoji picker в инпуте | `emoji-mart` — готовый компонент |
| Вставка в текст | `emoji-mart` возвращает unicode символ → вставляем в textarea |
| Реакции на сообщения | Тот же `emoji-mart` (см. Блок 4) |
| Хранение | Обычный unicode в БД — никаких спецхранилищ |

**Важно:** emoji это просто unicode, бэкенд ничего не знает о них.

---

## Блок 8: Система дружбы

> **Статус:** Планируется, не спроектирован

- Запрос в друзья → уведомление через Блок 1 (`notification:friend_request`)
- Принятие/отклонение → уведомление
- Список друзей → фильтр для онлайн-статуса (опционально, если решим не показывать всем)
