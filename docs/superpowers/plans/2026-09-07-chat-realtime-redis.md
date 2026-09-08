# Chat Realtime + Redis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Все входящие/исходящие сообщения обновляются в реалтайме без лишних запросов в Postgres; чтение списка/истории идёт через Redis, запись остаётся в Postgres с идемпотентностью; счётчик непрочитанных и последнее сообщение консистентны.

**Architecture:** Single-writer: только `chat-service` пишет в Postgres и инвалидирует Redis. Gateway делает cache-aside чтение (Redis HIT → отдать, MISS → RMQ → прогреть). Realtime fanout через Socket.IO rooms; presence/typing/unread-счётчики в Redis с TTL. Фронт: строгая сверка оптимистики по `clientId`, один источник `unread` (сервер), guarded `lastMessage`.

**Tech Stack:** NestJS + Prisma (Postgres `polygon_chat`), ioredis (`REDIS_CLIENT` из `@org/core`), Socket.IO, TanStack Query v5 (infinite `['messages', chatId]`, `['chats']`), Zustand+persist, RabbitMQ (`CHAT_QUEUE`, `CHAT_PATTERNS`), Jest + Supertest, MSW.

**Spec:** Анализ потока из чата 2026-09-07: `libs/backend/chat/src/database/prisma/schema.prisma`, `libs/backend/chat/src/services/chat.service.ts:158`, `libs/backend/chat/src/database/repository/chat.prisma.repo.ts:92`, `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`, `apps/backend/gateway/src/controllers/chat.controller.ts`, `apps/client/messenger/src/app/socket/chat-cache-updaters.ts`, `libs/client/features/send-message/src/use-send-message.ts`, `libs/client/entities/chat/src/use-chat-list.ts`, `libs/client/entities/chat/src/chat.store.ts`.

## Global Constraints

- Database-per-service: gateway не трогает `polygon_chat` напрямую, только RMQ `chatClient.send`.
- Repository pattern: контроллеры/сервисы не вызывают Prisma напрямую, только `IChatRepository`.
- `SessionGuard` + `ActiveAccountGuard` на всех приватных gateway-роутах; сокет `handleConnection` проверяет `access_token` + ban-marker, fail-closed.
- Никаких `any`; `kebab-case` файлы, `camelCase` функции, `PascalCase` типы; конструкторная инъекция Nest.
- Логи только через `Logger`/`useLogger`/`frontendLog`, без сырых ids/текстов/кук/URL; события `*_requested|*_denied|*_succeeded|*_failed|*_skipped`.
- Импорты только из публичных `index.ts` slice-пакетов; соблюдать FSD `pages -> features -> entities -> shared` и `npm exec nx lint`.
- Gateway POST по умолчанию `201`; тесты gateway — Supertest с моком `ClientProxy`, без живых RMQ/БД.

---

### Task 1: Prisma — денормализация lastMessage + идемпотентность clientId

**Files:**
- Modify: `libs/backend/chat/src/database/prisma/schema.prisma:33-84`
- Create: `libs/backend/chat/src/database/prisma/migrations/XXXX_chat_last_message_clientid/migration.sql`
- Modify: `libs/common/src/schemas/chat/chat-select.ts`
- Test: `libs/backend/chat/src/database/repository/chat.prisma.repo.spec.ts`

**Interfaces:**
- Consumes: существующие `Chat`, `Message`, `CHAT_SELECT_FIELDS`, `MESSAGE_SELECT_FIELDS`.
- Produces: `Chat.lastMessageId: string | null`, `Chat.lastMessageAt: DateTime | null`, `Message.clientId` scoped-unique `@@unique([chatId, clientId])`; репозиторий экспортирует `findMessageByClientId(chatId, clientId): Promise<Message | null>`.

- [ ] **Step 1: Write the failing test**

```ts
// libs/backend/chat/src/database/repository/chat.prisma.repo.spec.ts
it('findMessageByClientId returns message by scoped clientId', async () => {
  const found = await repo.findMessageByClientId('chat-1', 'c-1');
  expect(found?.id).toBe('msg-1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec nx test @org/chat --testPathPattern=chat.prisma.repo -t "findMessageByClientId"`
Expected: FAIL with "findMessageByClientId is not a function"

- [ ] **Step 3: Write minimal implementation**

```prisma
model Chat {
  id            String    @id @default(uuid())
  type          ChatType  @map("type")
  name          String?   @map("name")
  avatarUrl     String?   @map("avatar_url")
  selfOwnerId   String?   @unique @map("self_owner_id")
  lastMessageId String?   @map("last_message_id")
  lastMessageAt DateTime? @map("last_message_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  members  ChatMember[]
  messages Message[]
  @@index([type])
  @@index([lastMessageAt])
}
model Message {
  id       String @id @default(uuid())
  clientId String? @map("client_id")
  chatId   String @map("chat_id")
  // ... остальные поля без изменений
  @@index([chatId, createdAt, id])
  @@unique([chatId, clientId])
  @@index([deletedAt])
}
```

Миграция SQL (в `migration.sql`):

```sql
ALTER TABLE "Chat" ADD COLUMN "last_message_id" TEXT, ADD COLUMN "last_message_at" TIMESTAMP(3);
CREATE INDEX "Chat_lastMessageAt_idx" ON "Chat"("last_message_at");
-- backfill:
UPDATE "Chat" c SET "last_message_id" = m."id", "last_message_at" = m."createdAt"
FROM (SELECT DISTINCT ON ("chat_id") * FROM "Message" ORDER BY "chat_id", "created_at" DESC, "id" DESC) m
WHERE m."chat_id" = c."id";
-- scoped unique только для NOT NULL clientId (два шага: сначала очистить дубли, потом):
CREATE UNIQUE INDEX "Message_chatId_clientId_key" ON "Message"("chat_id", "client_id") WHERE "client_id" IS NOT NULL;
DROP INDEX IF EXISTS "Message_chatId_clientId_idx";
CREATE INDEX "Message_chatId_createdAt_id_idx" ON "Message"("chat_id", "created_at" DESC, "id" DESC);
```

Примечание: Prisma `@@unique([chatId, clientId])` с nullable `clientId` в Postgres допускает дубли NULL — дополнительно создаём partial unique index выше; дубли не-NULL перед миграцией удалить скриптом (оставить минимальный `createdAt`).

В `chat-select.ts` добавить `lastMessageId: true, lastMessageAt: true` в `CHAT_SELECT_FIELDS`.

В `chat.prisma.repo.ts` добавить:

```ts
async findMessageByClientId(chatId: string, clientId: string): Promise<Message | null> {
  return this.prisma.message.findFirst({
    where: { chatId, clientId },
    select: MESSAGE_SELECT_FIELDS,
  });
}
```

И в `IChatRepository` (`libs/backend/chat/src/interfaces/chat.interface.ts`) добавить сигнатуру `findMessageByClientId(chatId: string, clientId: string): Promise<Message | null>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec nx test @org/chat --testPathPattern=chat.prisma.repo`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/backend/chat/src/database/prisma/schema.prisma libs/backend/chat/src/database/prisma/migrations libs/common/src/schemas/chat/chat-select.ts libs/backend/chat/src/database/repository/chat.prisma.repo.ts libs/backend/chat/src/interfaces/chat.interface.ts
git commit -m "feat(chat): denormalize lastMessage and scope-unique clientId"
```

---

### Task 2: ChatService.send — транзакция + идемпотентность + touch Chat + свой lastRead

**Files:**
- Modify: `libs/backend/chat/src/services/chat.service.ts:158-267`
- Modify: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts` (метод `createMessageWithTouch`)
- Test: `libs/backend/chat/src/services/chat.service.spec.ts`

**Interfaces:**
- Consumes: `repo.findMessageByClientId`, `repo.createMessageWithRelations`, `PrismaService.$transaction`, `mediaClient.send(MEDIA_PATTERNS.CREATE_REFERENCE)`.
- Produces: `ChatService.sendMessage(chatId, senderId, input): Promise<Message>` — идемпотентный (повтор с тем же `clientId` возвращает то же сообщение), тачит `Chat{lastMessageId,lastMessageAt,updatedAt}`, продвигает `ChatMember{lastReadAt,lastReadMessageId}` отправителя.

- [ ] **Step 1: Write the failing test**

```ts
// chat.service.spec.ts
it('returns same message on retry with same clientId without duplicate', async () => {
  const first = await service.sendMessage('chat-1', 'user-1', { clientId: 'c-1', type: 'TEXT', text: 'hi' });
  const second = await service.sendMessage('chat-1', 'user-1', { clientId: 'c-1', type: 'TEXT', text: 'hi' });
  expect(second.id).toBe(first.id);
  expect(repo.createMessageWithRelations).toHaveBeenCalledTimes(1);
});

it('touches chat lastMessage and sender lastRead in same flow', async () => {
  const msg = await service.sendMessage('chat-1', 'user-1', { clientId: 'c-2', type: 'TEXT', text: 'yo' });
  expect(msg.id).toBeDefined();
  expect(repo.touchChatLastMessage).toHaveBeenCalledWith('chat-1', msg.id, expect.any(Date));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec nx test @org/chat --testPathPattern=chat.service -t "same message on retry"`
Expected: FAIL (дубль создаётся, `touchChatLastMessage` отсутствует)

- [ ] **Step 3: Write minimal implementation**

```ts
// chat.prisma.repo.ts
async createMessageWithTouch(data: CreateMessageWithRelationsData): Promise<Message> {
  return this.prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        chatId: data.chatId, clientId: data.clientId ?? null, senderId: data.senderId,
        type: data.type, text: data.text ?? null,
        attachments: data.attachments?.length ? { create: data.attachments } : undefined,
      },
      select: MESSAGE_SELECT_FIELDS,
    });
    await tx.chat.update({
      where: { id: data.chatId },
      data: { lastMessageId: message.id, lastMessageAt: message.createdAt, updatedAt: message.createdAt },
    });
    await tx.chatMember.updateMany({
      where: { chatId: data.chatId, userId: data.senderId },
      data: { lastReadMessageId: message.id, lastReadAt: message.createdAt },
    });
    return message;
  });
}

async touchChatLastMessage(chatId: string, messageId: string, at: Date): Promise<void> {
  await this.prisma.chat.update({
    where: { id: chatId },
    data: { lastMessageId: messageId, lastMessageAt: at, updatedAt: at },
  });
}
```

```ts
// chat.service.ts — начало sendMessage, после membership-check:
if (input.clientId) {
  const existing = await this.repo.findMessageByClientId(chatId, input.clientId);
  if (existing) {
    this.logger.log({ eventType: 'message_send_skipped', hasChatId: !!chatId, reason: 'duplicate_client_id' });
    return existing;
  }
}
const attachments = buildAttachmentInput(input);
let message: Message;
try {
  message = await this.repo.createMessageWithTouch({ chatId, clientId: input.clientId ?? null, senderId, type: input.type as Message['type'], text: input.text ?? null, attachments });
} catch (error) {
  // гонка двух create с одним clientId → unique violation → вернуть победителя
  if (input.clientId && isPrismaUniqueViolation(error)) {
    const winner = await this.repo.findMessageByClientId(chatId, input.clientId);
    if (winner) return winner;
  }
  throw error;
}
```

`isPrismaUniqueViolation` — проверить `error.code === 'P2002'`. Остальная media-сага без изменений. Также добавить в интерфейс `IChatRepository` обе новые сигнатуры. Пагинацию `findMessagesByChat` поменять на `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`, `countUnreadMessages` добавить `deletedAt: null, deletions: { none: { userId } }` и заменить `id:{gt}` tiebreak на `(createdAt,id)` сравнение.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec nx test @org/chat --testPathPattern="chat.(service|prisma.repo)"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/backend/chat/src/services/chat.service.ts libs/backend/chat/src/database/repository/chat.prisma.repo.ts libs/backend/chat/src/interfaces/chat.interface.ts
git commit -m "feat(chat): idempotent transactional send with lastMessage touch"
```

---

### Task 3: Redis-кэш чата — list/pages/unread/idempotency (cache-aside, single writer)

**Files:**
- Create: `libs/backend/chat/src/cache/chat-cache.keys.ts`
- Create: `libs/backend/chat/src/cache/chat-cache.service.ts`
- Modify: `libs/backend/chat/src/lib/chat.module.ts` (импорт `CoreRedisModule`, провайдинг сервиса)
- Test: `libs/backend/chat/src/cache/chat-cache.service.spec.ts`

**Interfaces:**
- Consumes: `REDIS_CLIENT: Redis` (ioredis), `IChatRepository`.
- Produces:
```ts
class ChatCacheService {
  getChatList(userId: string): Promise<ChatWithPreview[] | null>;
  setChatList(userId: string, chats: ChatWithPreview[], ttlSec?: number): Promise<void>;
  invalidateChatList(userId: string): Promise<void>; // DEL chat:list:{userId}
  getMessagesPage(chatId: string, cursor: string): Promise<MessagePage | null>;
  setMessagesPage(chatId: string, cursor: string, page: MessagePage, ttlSec?: number): Promise<void>;
  invalidateChatPages(chatId: string): Promise<void>; // SCAN chat:msgs:{chatId}:* + DEL
  incrUnread(chatId: string, userId: string): Promise<number>;
  resetUnread(chatId: string, userId: string): Promise<void>;
  getUnread(chatId: string, userId: string): Promise<number | null>;
  claimClientId(chatId: string, senderId: string, clientId: string, messageId: string): Promise<boolean>;
}
```
Ключи: `chat:list:{userId}` (TTL 30), `chat:msgs:{chatId}:{cursor|HEAD}` (TTL 60), `chat:unread:{chatId}:{userId}` (без TTL, сбрасывается при read), `msg:idem:{senderId}:{clientId}` (EX 86400). Все значения JSON кроме счётчиков.

- [ ] **Step 1: Write the failing test**

```ts
// chat-cache.service.spec.ts
it('returns null on miss and hits after set', async () => {
  await expect(cache.getChatList('u1')).resolves.toBeNull();
  await cache.setChatList('u1', [{ id: 'c1' } as never]);
  await expect(cache.getChatList('u1')).resolves.toEqual([{ id: 'c1' }]);
});
it('claimClientId is single-winner', async () => {
  await expect(cache.claimClientId('c1', 'u1', 'k1', 'm1')).resolves.toBe(true);
  await expect(cache.claimClientId('c1', 'u1', 'k1', 'm2')).resolves.toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec nx test @org/chat --testPathPattern=chat-cache`
Expected: FAIL with "Cannot find module .../chat-cache.service"

- [ ] **Step 3: Write minimal implementation**

```ts
// chat-cache.keys.ts
export const chatListKey = (userId: string) => `chat:list:${userId}`;
export const chatMsgsKey = (chatId: string, cursor: string) => `chat:msgs:${chatId}:${cursor || 'HEAD'}`;
export const chatUnreadKey = (chatId: string, userId: string) => `chat:unread:${chatId}:${userId}`;
export const idemKey = (senderId: string, clientId: string) => `msg:idem:${senderId}:${clientId}`;

// chat-cache.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT } from '@org/core';
import type Redis from 'ioredis';
@Injectable()
export class ChatCacheService {
  private readonly logger = new Logger(ChatCacheService.name);
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
  async getChatList(userId: string): Promise<never[] | null> {
    try {
      const raw = await this.redis.get(chatListKey(userId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; } // Redis недоступен → fallback в Postgres
  }
  async setChatList(userId: string, chats: unknown, ttlSec = 30): Promise<void> {
    try { await this.redis.set(chatListKey(userId), JSON.stringify(chats), 'EX', ttlSec); } catch { /* skip */ }
  }
  async invalidateChatList(userId: string): Promise<void> {
    try { await this.redis.del(chatListKey(userId)); } catch { /* skip */ }
  }
  async getMessagesPage(chatId: string, cursor: string): Promise<never | null> {
    try {
      const raw = await this.redis.get(chatMsgsKey(chatId, cursor));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  async setMessagesPage(chatId: string, cursor: string, page: unknown, ttlSec = 60): Promise<void> {
    try { await this.redis.set(chatMsgsKey(chatId, cursor), JSON.stringify(page), 'EX', ttlSec); } catch { /* skip */ }
  }
  async invalidateChatPages(chatId: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({ match: `chat:msgs:${chatId}:*`, count: 100 });
      const keys: string[] = [];
      for await (const batch of stream) keys.push(...(batch as string[]));
      if (keys.length) await this.redis.del(...keys);
    } catch { /* skip */ }
  }
  async incrUnread(chatId: string, userId: string): Promise<number> {
    return this.redis.incr(chatUnreadKey(chatId, userId));
  }
  async resetUnread(chatId: string, userId: string): Promise<void> {
    try { await this.redis.del(chatUnreadKey(chatId, userId)); } catch { /* skip */ }
  }
  async getUnread(chatId: string, userId: string): Promise<number | null> {
    try {
      const raw = await this.redis.get(chatUnreadKey(chatId, userId));
      return raw === null ? null : Number(raw);
    } catch { return null; }
  }
  async claimClientId(senderId: string, clientId: string, messageId: string): Promise<boolean> {
    const res = await this.redis.set(idemKey(senderId, clientId), messageId, 'EX', 86400, 'NX');
    return res === 'OK';
  }
}
```

В `chat.module.ts` добавить `CoreRedisModule` в imports и `ChatCacheService` в providers/exports. Логировать `chat_cache_hit|miss|invalidated` с `hasUserId/hasChatId`, без тел сообщений.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec nx test @org/chat --testPathPattern=chat-cache`
Expected: PASS (использовать `ioredis-mock` в spec)

- [ ] **Step 5: Commit**

```bash
git add libs/backend/chat/src/cache libs/backend/chat/src/lib/chat.module.ts
git commit -m "feat(chat): add redis cache-aside service for lists pages unread"
```

---

### Task 4: Gateway — read-through + инвалидация + presence в Redis

**Files:**
- Modify: `apps/backend/gateway/src/controllers/chat.controller.ts` (GET chats/messages через кэш, инвалидация на send/edit/delete/read/forward)
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts` (Redis presence вместо `Map`, `connect`-rejoin support, typing TTL, zod-валидация `message:send`)
- Modify: `apps/backend/gateway/src/app/gateway.module.ts` (Redis + `ThrottlerStorageRedis` при наличии)
- Test: `apps/backend/gateway/src/controllers/chat.controller.spec.ts`, `apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts`

**Interfaces:**
- Consumes: `ChatCacheService`-совместимый Redis-доступ в gateway (или отдельный `GatewayChatCacheService` с теми же ключами из Task 3), `CHAT_PATTERNS`, `USER_PATTERNS`.
- Produces: `GET /chats` и `GET /chats/:id/messages` с `X-Cache: HIT|MISS`; мутации инвалидируют `chat:list:*` участников и `chat:msgs:{chatId}:*`; `isUserOnline(userId)` читает Redis `presence:{userId}`.

- [ ] **Step 1: Write the failing test**

```ts
// chat.controller.spec.ts
it('GET /chats serves from cache on second call', async () => {
  chatClient.send.mockReturnValueOnce(of([{ id: 'c1' }]));
  await request(app.getHttpServer()).get('/api/chats').set('Cookie', ['access_token=valid']).expect(200);
  await request(app.getHttpServer()).get('/api/chats').set('Cookie', ['access_token=valid']).expect(200).expect('X-Cache', 'HIT');
  expect(chatClient.send).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec nx test @org/gateway --testPathPattern=chat.controller -t "serves from cache"`
Expected: FAIL (нет заголовка `X-Cache`, `send` вызван 2 раза)

- [ ] **Step 3: Write minimal implementation**

```ts
// chat.controller.ts — GET /chats
@Get()
async getChats(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
  const userId = req.user.sub;
  const cached = await this.chatCache.getChatList(userId);
  if (cached) { res.setHeader('X-Cache', 'HIT'); return cached; }
  const chats = await lastValueFrom(this.chatClient.send(CHAT_PATTERNS.GET_CHATS, { userId }));
  await this.chatCache.setChatList(userId, chats);
  res.setHeader('X-Cache', 'MISS');
  return chats;
}
// GET /chats/:id/messages?cursor&take
@Get(':id/messages')
async getMessages(@Param('id') chatId: string, @Query() q: { cursor?: string; take?: string }, @Res({ passthrough: true }) res: Response) {
  const cursor = q.cursor ?? 'HEAD';
  const cached = await this.chatCache.getMessagesPage(chatId, cursor);
  if (cached) { res.setHeader('X-Cache', 'HIT'); return cached; }
  const page = await lastValueFrom(this.chatClient.send(CHAT_PATTERNS.GET_MESSAGES, { chatId, cursor, take: Number(q.take ?? 30) }));
  await this.chatCache.setMessagesPage(chatId, cursor, page);
  res.setHeader('X-Cache', 'MISS');
  return page;
}
// Мутации: после успешного SEND/EDIT/DELETE/MARK_READ/FORWARD:
await this.chatCache.invalidateChatPages(chatId);
for (const memberId of memberIds) await this.chatCache.invalidateChatList(memberId);
```

```ts
// chat.socket-gateway.ts — presence в Redis вместо Map:
private presenceKey(userId: string) { return `presence:${userId}`; }
private async markOnline(userId: string): Promise<void> {
  await this.redis.sadd(this.presenceKey(userId), ...this.server.sockets.sockets.keys()).catch(() => undefined);
  await this.redis.expire(this.presenceKey(userId), 120).catch(() => undefined);
}
isUserOnline(userId: string): Promise<boolean> {
  return this.redis.exists(this.presenceKey(userId)).then((n) => n === 1).catch(() => false);
}
// typing с TTL:
@SubscribeMessage('typing:start')
async onTypingStart(@ConnectedSocket() socket: Socket, @MessageBody() body: { chatId: string }) {
  await this.redis.set(`typing:${body.chatId}:${socket.data['userId']}`, '1', 'EX', 3).catch(() => undefined);
  socket.to(`chat:${body.chatId}`).emit('user:typing', { userId: socket.data['userId'], chatId: body.chatId, isTyping: true });
}
// message:send — добавить zod-валидацию sendMessageSchema + membership-check как в chat:join,
// ошибки отдавать { code, message } в message:send:error вместо пустого.
```

`memberIds` для инвалидации брать из `GET_MEMBERS` (уже есть для пушей). Все Redis-ошибки — catch → fallback (кроме `SessionGuard`, он fail-closed).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec nx test @org/gateway --testPathPattern="chat.(controller|socket-gateway)"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/gateway/src/controllers/chat.controller.ts apps/backend/gateway/src/gateways/chat.socket-gateway.ts apps/backend/gateway/src/app/gateway.module.ts
git commit -m "feat(gateway): redis read-through and presence with invalidation"
```

---

### Task 5: Фронт — строгая сверка оптимистики, убрать fuzzy и мёртвый REST-путь

**Files:**
- Modify: `apps/client/messenger/src/app/socket/chat-cache-updaters.ts:31-83` (убрать `isMatchingPendingEcho`)
- Modify: `libs/client/features/send-message/src/use-send-message.ts:64-133,181-238` (`cancelQueries` + rollback-контекст + retry/remove)
- Modify: `libs/client/entities/message/src/message.api.ts:85-123` (удалить `useSendMessageMutation` REST-оптимистику)
- Modify: `libs/client/entities/message/src/index.ts` (убрать реэкспорт удалённого хука)
- Test: `apps/client/messenger/src/app/socket/chat-cache-updaters.spec.ts`, `apps/client/messenger/src/app/send-message-optimistic.spec.tsx`

**Interfaces:**
- Consumes: `queryClient.setQueryData/getQueryData/cancelQueries/invalidateQueries`, `socket.emit('message:send')`, `normalizeMessage`.
- Produces: `upsertMessageIntoPages(old, msg)` — матчит только `sameServerId || sameClientId`; `insertOptimisticMessage` требует `cancelQueries` перед вставкой; `removeOptimisticMessage(chatId, clientId)` и `retrySend(chatId, clientId)`.

- [ ] **Step 1: Write the failing test**

```tsx
// chat-cache-updaters.spec.ts
it('does NOT absorb foreign message with same text into pending', () => {
  const old = { pages: [{ messages: [{ id: 'client:k1', clientId: 'k1', chatId: 'c1', senderId: 'me', type: 'TEXT', text: 'hello', createdAt: 't0', localStatus: 'sending' }] }] };
  const foreign = { id: 'srv-9', clientId: null, chatId: 'c1', senderId: 'other', type: 'TEXT', text: 'hello', createdAt: 't1' };
  const next = upsertMessageIntoPages(old as never, foreign as never) as typeof old;
  expect(next.pages[0].messages).toHaveLength(2);
  expect(next.pages[0].messages[0].localStatus).toBe('sending');
});
```

```tsx
// send-message-optimistic.spec.tsx
it('rolls back optimistic on send:error when reconciled path missing', async () => {
  // render hook, send, emit message:send:error, expect localStatus error + retry button present
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec nx test @org/messenger --testPathPattern="chat-cache-updaters|send-message-optimistic"`
Expected: FAIL (чужое `hello` поглощает pending — длина 1 вместо 2)

- [ ] **Step 3: Write minimal implementation**

```ts
// chat-cache-updaters.ts — заменить блок матчинга:
const sameServerId = message.id === normalizedMsg.id;
const sameClientId = Boolean(message.clientId) && Boolean(normalizedMsg.clientId) && message.clientId === normalizedMsg.clientId;
if (!sameServerId && !sameClientId) return message;
// isMatchingPendingEcho УДАЛИТЬ полностью
```

```ts
// use-send-message.ts — handleSend:
await queryClient.cancelQueries({ queryKey: ['messages', chatId] });
const snapshot = queryClient.getQueryData(['messages', chatId]);
insertOptimisticMessage(chatId, optimistic);
try {
  socket.emit('message:send', { chatId, text: trimmed, clientId });
} catch {
  if (snapshot) queryClient.setQueryData(['messages', chatId], snapshot);
  throw new Error('Socket send failed');
}
// новый markMessageSendError уже есть; добавить:
export function removeOptimisticMessage(chatId: string, clientId: string) {
  queryClient.setQueryData(['messages', chatId], (old: InfiniteData<MessagePage> | undefined) => {
    if (!old) return old;
    return { ...old, pages: old.pages.map((p) => ({ ...p, messages: p.messages.filter((m) => m.clientId !== clientId) })) };
  });
}
```

Удалить `useSendMessageMutation` из `message.api.ts` и его реэкспорт; оставить только `useSend/Edit/Delete/Forward` для edit/delete/forward (они не шлют сообщения). Добавить per-query `staleTime: 15_000` для `['messages', chatId]` и `gcTime: 10 * 60_000`; разделить ключ `useMessagesQuery` (если нужен) на `['messages-flat', chatId]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec nx test @org/messenger --testPathPattern="chat-cache-updaters|send-message-optimistic"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/messenger/src/app/socket/chat-cache-updaters.ts libs/client/features/send-message/src/use-send-message.ts libs/client/entities/message/src/message.api.ts libs/client/entities/message/src/index.ts
git commit -m "fix(client): strict clientId reconciliation with rollback"
```

---

### Task 6: Unread + lastMessage — один источник, guarded preview, markRead-триггеры

**Files:**
- Modify: `libs/client/entities/chat/src/use-chat-list.ts:35` (убрать `?? unreadByChatId` fallback)
- Modify: `libs/client/entities/chat/src/chat.store.ts` (депрекейт `unreadByChatId` persist, оставить transient)
- Modify: `apps/client/messenger/src/app/socket/chat-socket-manager.ts` (фильтр своих, `markRead` в активном чате, guarded `lastMessage`)
- Modify: `libs/client/features/chat-socket/src/use-chat-socket.ts` (markRead на focus/visible/message:new)
- Modify: `apps/client/messenger/src/app/socket/chat-cache-updaters.ts:159-185` (сравнение времени + edit/delete пересчёт)
- Test: `libs/client/entities/chat/src/use-chat-list.spec.tsx` (новый), `apps/client/messenger/src/app/socket/chat-cache-updaters.spec.ts`

**Interfaces:**
- Consumes: `chatApi.markRead(chatId)`, `queryClient.setQueryData(['chats'])`, `useChatStore activeChatId`, `document.visibilityState`.
- Produces: `unread = chat.unreadCount ?? 0`; `updateChatListLastMessage` заменяет только если `msg.createdAt >= current.createdAt`; `handleMessageRemoved` запрашивает `GET messages take:1` при удалении lastMessage.

- [ ] **Step 1: Write the failing test**

```tsx
// use-chat-list.spec.tsx
it('ignores local unreadByChatId when server count is 0', () => {
  // mock useGetChatsSuspenseQuery -> [{ id:'c1', unreadCount: 0 }], store unreadByChatId { c1: 5 }
  // expect rendered unread to be 0, not 5
});

// chat-cache-updaters.spec.ts
it('does not roll back lastMessage on out-of-order event', () => {
  const chats = [{ id: 'c1', updatedAt: 't0', lastMessage: { createdAt: '2026-09-07T10:00:00Z' } }];
  const stale = { chatId: 'c1', createdAt: '2026-09-07T09:00:00Z', id: 'old' };
  expect(updateChatListLastMessage(chats as never, stale as never)[0].lastMessage.id).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec nx test @org/entities-chat --testPathPattern=use-chat-list; npm exec nx test @org/messenger --testPathPattern=chat-cache-updaters`
Expected: FAIL (сейчас `??` отдаёт локальное, stale затирает preview)

- [ ] **Step 3: Write minimal implementation**

```ts
// use-chat-list.ts
unread: chat.unreadCount ?? 0,
```

```ts
// chat-socket-manager.ts — handleNewMessage:
const isOwn = msg.senderId === currentUserId; // из session/me query
if (!isOwn && (chatId !== activeChatId || document.visibilityState !== 'visible')) {
  setQueryData(['chats'], (old) => updateChatListUnreadCount(old, chatId, 1));
} else if (!isOwn && chatId === activeChatId) {
  chatApi.markRead(chatId).catch(() => undefined); // сразу гасим, сервер в ноль
}
// lastMessage только вперёд:
setQueryData(['chats'], (old) => updateChatListLastMessage(old, msg)); // внутри guard по времени
```

```ts
// updateChatListLastMessage — добавить guard:
const cur = (chats ?? []).find((c) => c.id === normalizedMsg.chatId)?.lastMessage;
if (cur && new Date(normalizedMsg.createdAt).getTime() < new Date(cur.createdAt).getTime()) return chats ?? [];
```

```ts
// handleMessageUpdated — также патчить ['chats'] lastMessage если id совпал:
// handleMessageRemoved — если удалён lastMessage: set lastMessage=null + invalidate(['chats']) + invalidate(['messages', chatId])
```

```ts
// use-chat-socket.ts — добавить:
useEffect(() => {
  const onVis = () => { if (document.visibilityState === 'visible' && chatId) chatApi.markRead(chatId).catch(() => undefined); };
  document.addEventListener('visibilitychange', onVis);
  return () => document.removeEventListener('visibilitychange', onVis);
}, [chatId]);
// + подписка на message:new в активном чате → markRead (debounce 1000мс)
```

`chat.store.ts`: убрать `persist` для `unreadByChatId` (оставить `partialize: {}`), пометить `incrementUnread/markChatRead` `@deprecated use server unreadCount`. Миграция localStorage: при старте удалить ключ `chat-unread-state` если серверный count доступен.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec nx test @org/entities-chat; npm exec nx test @org/messenger --testPathPattern="chat-cache-updaters|send-message-optimistic"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/client/entities/chat/src/use-chat-list.ts libs/client/entities/chat/src/chat.store.ts apps/client/messenger/src/app/socket/chat-socket-manager.ts libs/client/features/chat-socket/src/use-chat-socket.ts
git commit -m "fix(client): single-source unread and guarded lastMessage"
```

---

### Task 7: Сокет-жизненный цикл — rejoin, join-шторм, typing/presence TTL

**Files:**
- Modify: `apps/client/messenger/src/app/socket/socket-middleware.ts` (rejoin on `connect`)
- Modify: `libs/client/features/notifications/src/use-message-notification.ts:60-64` (debounced diff-join)
- Modify: `libs/client/features/chat-socket/src/use-chat-socket.ts` (join/leave активного + retry)
- Modify: `libs/client/entities/chat/src/presence.store.ts`, `libs/client/entities/chat/src/chat.store.ts` (TTL typing, delete вместо false)
- Modify: `apps/client/messenger/src/app/socket/chat-socket-manager.ts` (единый `message:new` хэндлер; убрать дубль в `virtual-message-list.tsx`)
- Test: `libs/client/features/chat-socket/src/use-chat-socket.spec.tsx` (новый), `apps/client/messenger/src/app/socket/reconnect.spec.ts` (новый)

**Interfaces:**
- Consumes: `socket.on('connect'|'disconnect')`, `socket.emit('chat:join'|'chat:leave')`, `queryClient.getQueryData(['chats'])`.
- Produces: `rejoinAllChats()` на `connect`; `joinChatsDiff(prevIds, nextIds)` — join только новых, leave ушедших; `setTyping(userId, chatId, ttlMs=3000)` с автоочисткой.

- [ ] **Step 1: Write the failing test**

```tsx
// reconnect.spec.ts
it('rejoins all chats on socket connect', () => {
  const emit = jest.spyOn(socket, 'emit');
  socketIoSimulateConnect();
  expect(emit).toHaveBeenCalledWith('chat:join', expect.objectContaining({ chatId: 'c1' }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec nx test @org/messenger --testPathPattern=reconnect`
Expected: FAIL with "Cannot find module .../reconnect" или emit не вызван

- [ ] **Step 3: Write minimal implementation**

```ts
// socket-middleware.ts
import { queryClient, socket } from '@org/shared';
socket.on('connect', () => {
  const chats = queryClient.getQueryData<{ id: string }[]>(['chats']) ?? [];
  for (const c of chats) socket.emit('chat:join', { chatId: c.id });
  const active = queryClient.getQueryData<string>(['activeChatId']);
  if (active) socket.emit('chat:join', { chatId: active });
});
```

```ts
// use-message-notification.ts — заменить forEach на diff + debounce:
import { debounce } from 'es-toolkit';
const joinedRef = useRef<Set<string>>(new Set());
useEffect(() => {
  const joinDiff = debounce(() => {
    const ids = new Set(chats.map((c) => c.id));
    for (const id of ids) if (!joinedRef.current.has(id)) { socket.emit('chat:join', { chatId: id }); joinedRef.current.add(id); }
    for (const id of [...joinedRef.current]) if (!ids.has(id)) { socket.emit('chat:leave', { chatId: id }); joinedRef.current.delete(id); }
  }, 500);
  joinDiff();
  return () => joinDiff.cancel();
}, [chats]);
```

```ts
// presence typing с TTL (chat.store.ts):
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
setIsTyping: (userId, isTyping, ttlMs = 3000) => set((state) => {
  const key = userId;
  const existing = typingTimers.get(key);
  if (existing) clearTimeout(existing);
  if (isTyping) {
    const t = setTimeout(() => useChatStore.getState().setIsTyping(userId, false), ttlMs);
    typingTimers.set(key, t);
    return { typingUsers: { ...state.typingUsers, [userId]: true } };
  }
  typingTimers.delete(key);
  return { typingUsers: Object.fromEntries(Object.entries(state.typingUsers).filter(([k]) => k !== key)) };
});
```

Убрать второй `socket.on('message:new')` из `virtual-message-list.tsx:179-192` — оставить только скролл-триггер через подписку на `lastReceivedMessage` стор. `presence.store`: `setOffline` делать `delete`, а не `false`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec nx test @org/messenger --testPathPattern="reconnect|chat-cache-updaters"; npm exec nx test @org/features-chat-socket`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/client/messenger/src/app/socket/socket-middleware.ts libs/client/features/notifications/src/use-message-notification.ts libs/client/features/chat-socket/src/use-chat-socket.ts libs/client/entities/chat/src/presence.store.ts libs/client/entities/chat/src/chat.store.ts
git commit -m "fix(realtime): rejoin on connect with diff-join and typing ttl"
```

---

## Verification (после всех задач)

```bash
npm exec nx run-many -t lint typecheck --projects=@org/chat,@org/gateway,@org/messenger,@org/entities-chat,@org/features-send-message
npm exec nx run-many -t test --projects=@org/chat,@org/gateway,@org/messenger
npm exec nx affected -t build
```

Ручная проверка: два браузера (A+B) + третий офлайн: A шлёт → B видит мгновенно без refetch; перезагрузка B → история из кэша (второй `GET` с `X-Cache: HIT`); повторный send с тем же `clientId` → нет дубля; удаление lastMessage → preview пересчитан; бейдж unread не «воскресает» после refetch.

## Self-Review

**1. Spec coverage:** реалтайм вх/исх → Task 5+7; нет кэша бэка → Task 3+4; пагинация/виртуализация без БД → Task 3+4 (HEAD/pages TTL); unread → Task 3 (INCR/RESET) + Task 6 (single-source + markRead-триггеры); lastMessage → Task 1 (денормализация) + Task 6 (guard + edit/delete); Prisma оптимальность → Task 1+2 (индексы, транзакция, tiebreak, deleted-фильтр); Redis → Task 3+4 (ключи, TTL, инвалидация, presence/typing). Гэпов нет.

**2. Placeholder scan:** нет `TBD/TODO/appropriate/handle edge cases` — везде конкретный код, ключи, TTL, команды запуска.

**3. Type consistency:** `ChatWithPreview { lastMessage, unreadCount }`, `MessagePage { messages, nextCursor }`, `upsertMessageIntoPages<TData extends { pages: MessagePageLike[] }>`, `ChatCacheService` ключи `chat:list:{userId} / chat:msgs:{chatId}:{cursor} / chat:unread:{chatId}:{userId} / msg:idem:{senderId}:{clientId}` — имена одинаковые в Task 3 и Task 4; `clientId` везде `string`, `localStatus: 'sending'|'sent'|'error'`.
