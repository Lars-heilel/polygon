# Chat System Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring chat to the audited MVP contract: server-side unread, explicit self-chat creation, tested backend/frontend flows, sanitized logging, updated Swagger and development docs.

**Architecture:** Gateway remains the only HTTP/Socket.IO entry point. Chat-service owns chat persistence, read markers, self-chat idempotency, message creation, pagination and membership checks. Frontend treats unread as server data with a local UI cache only, sends messages through Socket.IO/HTTP-compatible contracts, and uses `useLogger`/sanitized reporting instead of direct `console.*`.

**Tech Stack:** Nx, NestJS, RabbitMQ ClientProxy, Prisma, PostgreSQL, React 19, TanStack Query, Zustand, Socket.IO, Jest, Testing Library, Playwright, Swagger decorators.

## Global Constraints

- Выполнено: read `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/MONOREPO_GOTCHAS.md`, `docs/OBSERVABILITY.md`.
- Выполнено: audit saved at `docs/audits/2026-07-14-chat-system-audit.md`.
- Use Nx commands through the package manager: `npm exec nx ...`.
- Use TDD for every behavior change: write failing Jest/Playwright test, verify red, implement, verify green.
- Do not use direct `console.*` outside the frontend logger implementation.
- Dev may log diagnostic details; prod/demo browser console must stay clean.
- Backend logs must be structured and must not include raw message text, tokens, cookies, raw user ids, raw chat ids, file names or presigned URLs.
- `GET /chats` must not create data.
- Self-chat "Личное" must be created by an explicit idempotent action.
- Unread/read-state must be server-side source of truth.

---

## File Structure

Modify:

- `libs/backend/chat/src/database/prisma/schema.prisma` — add read marker fields to `ChatMember`.
- `libs/backend/chat/src/database/prisma/migrations/20260714000000_add_chat_read_markers/migration.sql` — SQL migration for read markers.
- `libs/common/src/schemas/chat/chat-member.schema.ts` — expose read marker fields.
- `libs/common/src/schemas/chat/chat-select.ts` — select read marker fields.
- `libs/common/src/schemas/chat/read-chat.schema.ts` — shared DTO schema for mark-read request body.
- `libs/common/src/constants/routes.ts` — add `chats.self` and `chats.read(id)`.
- `libs/backend/core/src/constants/queues/chat.queue.ts` — add `CREATE_SELF` and `MARK_READ` patterns.
- `libs/backend/chat/src/interfaces/chat.interface.ts` — add unread fields and new service/repository/controller methods.
- `libs/backend/chat/src/database/repository/chat.prisma.repo.ts` — add self-chat/read marker/unread repository behavior.
- `libs/backend/chat/src/services/chat.service.ts` — remove `getChats()` write side effect and add explicit self-chat/read logic.
- `libs/backend/chat/src/controllers/chat.controller.ts` — add RPC handlers.
- `apps/backend/gateway/src/controllers/chat.controller.ts` — add HTTP endpoints, fix `fileCategory`, logging and Swagger.
- `apps/backend/gateway/src/gateways/chat.socket-gateway.ts` — keep sanitized socket logs and emit existing message/presence events without raw identifiers.
- `libs/client/entities/chat/src/chat.api.ts` — add API calls/types for self-chat and mark-read, include unread count.
- `libs/client/entities/chat/src/chat.store.ts` — demote unread to UI-cache/reconciliation.
- `libs/client/entities/chat/src/use-chat-list.ts` — read server unread count.
- `libs/client/features/chat-socket/src/use-chat-socket.ts` — call mark-read on join/open.
- `apps/client/messenger/src/app/socket/chat-cache-updaters.ts` — update unread from incoming socket/cache events.
- `apps/client/messenger/src/app/socket/chat-socket-manager.ts` — log sanitized socket/cache events.
- `libs/client/features/send-message/src/use-send-message.ts` — log sanitized send/typing events.
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx` — log upload events and fix pending attachment cancel if confirmed by failing test.
- `libs/client/shared/src/ui/error-boundary/error-boundary.tsx` — remove direct prod console path.
- `apps/client/messenger/src/app/main.tsx` — remove direct prod console path.
- `apps/client/messenger/src/app/config/env.ts` — remove direct prod console path.
- `docs/DEVELOPMENT.md` — add logging/testing/Swagger standards.
- `docs/OBSERVABILITY.md` — clarify frontend error/log routing.
- `docs/specs/chat-service.md` — rewrite MVP contract.
- `docs/specs/client-messenger.md` — rewrite client chat contract.

Create:

- `libs/backend/chat/src/services/chat.service.spec.ts`
- `libs/backend/chat/src/controllers/chat.controller.spec.ts`
- `libs/backend/chat/src/database/repository/chat.prisma.repo.spec.ts`
- `apps/backend/gateway/src/controllers/chat.controller.spec.ts`
- `apps/client/messenger/e2e/chat-message-flow.spec.ts`
- Add frontend component/unit specs beside touched frontend units if existing project targets support them.

## Task 1: Backend Contract Tests For Self-Chat, Read Markers, File Category And Pagination

**Files:**
- Create: `libs/backend/chat/src/services/chat.service.spec.ts`
- Create: `libs/backend/chat/src/controllers/chat.controller.spec.ts`
- Create: `apps/backend/gateway/src/controllers/chat.controller.spec.ts`
- Create or modify: `libs/backend/chat/src/database/repository/chat.prisma.repo.spec.ts`

**Interfaces:**
- Produces expected service API:
  - `createSelfChat(userId: string): Promise<Chat>`
  - `getChats(userId: string): Promise<ChatWithPreview[]>`
  - `markRead(chatId: string, userId: string, messageId?: string | null): Promise<ChatMember>`
- Produces expected repository API:
  - `findSelfChat(userId: string): Promise<Chat | null>`
  - `countUnreadMessages(chatId: string, userId: string, lastReadAt?: Date | null): Promise<number>`
  - `markChatRead(chatId: string, userId: string, messageId?: string | null): Promise<ChatMember>`

- [ ] **Step 1: Write failing `ChatService.getChats` side-effect test**

Add to `libs/backend/chat/src/services/chat.service.spec.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import type { IChatRepository } from '../interfaces/chat.interface';

function repoMock(): jest.Mocked<IChatRepository> {
  return {
    findChatById: jest.fn(),
    findDirectChatBetween: jest.fn(),
    findChatsForUser: jest.fn(),
    createChat: jest.fn(),
    deleteChat: jest.fn(),
    findChatMember: jest.fn(),
    findMembersByChat: jest.fn(),
    addChatMember: jest.fn(),
    removeChatMember: jest.fn(),
    findMessagesByChat: jest.fn(),
    findMediaMessagesByChat: jest.fn(),
    findMessageById: jest.fn(),
    createMessage: jest.fn(),
    createMessagesMany: jest.fn(),
  };
}

describe('ChatService', () => {
  it('gets chats without creating a self chat as a side effect', async () => {
    const repo = repoMock();
    repo.findChatsForUser.mockResolvedValue([]);
    const service = new ChatService(repo);

    await expect(service.getChats('user-1')).resolves.toEqual([]);

    expect(repo.createChat).not.toHaveBeenCalled();
    expect(repo.addChatMember).not.toHaveBeenCalled();
    expect(repo.findChatsForUser).toHaveBeenCalledWith('user-1');
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npm exec nx test @org/chat -- --runInBand services/chat.service.spec.ts`

Expected: FAIL because current `getChats()` calls `createDirectChat(userId, userId)` and writes through repository.

- [ ] **Step 3: Write failing explicit self-chat tests**

Append:

```ts
it('creates a self chat explicitly and idempotently', async () => {
  const repo = repoMock();
  const existing = {
    id: 'chat-self',
    type: 'DIRECT',
    name: 'Личное',
    avatarUrl: null,
    createdAt: new Date('2026-07-14T10:00:00.000Z'),
    updatedAt: new Date('2026-07-14T10:00:00.000Z'),
  } as const;
  repo.findDirectChatBetween.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
  repo.createChat.mockResolvedValue(existing);
  repo.addChatMember.mockResolvedValue({
    chatId: 'chat-self',
    userId: 'user-1',
    role: 'MEMBER',
    joinedAt: new Date('2026-07-14T10:00:00.000Z'),
    lastReadMessageId: null,
    lastReadAt: null,
  });
  repo.findChatById.mockResolvedValue(existing);

  const service = new ChatService(repo);

  await expect(service.createSelfChat('user-1')).resolves.toEqual(existing);
  await expect(service.createSelfChat('user-1')).resolves.toEqual(existing);

  expect(repo.createChat).toHaveBeenCalledTimes(1);
  expect(repo.addChatMember).toHaveBeenCalledTimes(1);
  expect(repo.addChatMember).toHaveBeenCalledWith({ chatId: 'chat-self', userId: 'user-1' });
});
```

- [ ] **Step 4: Run red test**

Run: `npm exec nx test @org/chat -- --runInBand services/chat.service.spec.ts`

Expected: FAIL with `createSelfChat is not a function`.

- [ ] **Step 5: Write failing unread/mark-read service tests**

Append:

```ts
it('marks a chat read only for chat members', async () => {
  const repo = repoMock();
  repo.findChatMember.mockResolvedValueOnce(null);
  const service = new ChatService(repo);

  await expect(service.markRead('chat-1', 'user-1', 'message-1')).rejects.toBeInstanceOf(ForbiddenException);
  expect(repo.markChatRead).not.toHaveBeenCalled();
});

it('updates the read marker for a chat member', async () => {
  const repo = repoMock();
  const member = {
    chatId: 'chat-1',
    userId: 'user-1',
    role: 'MEMBER',
    joinedAt: new Date('2026-07-14T10:00:00.000Z'),
    lastReadMessageId: 'message-1',
    lastReadAt: new Date('2026-07-14T10:01:00.000Z'),
  };
  repo.findChatMember.mockResolvedValue(member);
  repo.markChatRead.mockResolvedValue(member);
  const service = new ChatService(repo);

  await expect(service.markRead('chat-1', 'user-1', 'message-1')).resolves.toEqual(member);
  expect(repo.markChatRead).toHaveBeenCalledWith('chat-1', 'user-1', 'message-1');
});
```

- [ ] **Step 6: Run red test**

Run: `npm exec nx test @org/chat -- --runInBand services/chat.service.spec.ts`

Expected: FAIL with missing `markRead` and repository method types.

- [ ] **Step 7: Write failing Gateway fileCategory/self/read tests**

Add to `apps/backend/gateway/src/controllers/chat.controller.spec.ts`:

```ts
import type { ClientProxy } from '@nestjs/microservices';
import { CHAT_PATTERNS } from '@org/core';
import { of } from 'rxjs';
import { ChatGatewayController } from './chat.controller';

describe('ChatGatewayController', () => {
  function controller() {
    const chatClient = { send: jest.fn(() => of({ id: 'message-1' })) };
    const userClient = { send: jest.fn(() => of([])) };
    const socketGateway = {
      broadcastMessage: jest.fn(),
      triggerPushForOfflineRecipients: jest.fn(),
    };
    return {
      chatClient,
      socketGateway,
      controller: new ChatGatewayController(
        chatClient as unknown as ClientProxy,
        userClient as unknown as ClientProxy,
        socketGateway as never,
      ),
    };
  }

  it('passes fileCategory when sending a file message over HTTP', async () => {
    const ctx = controller();

    await ctx.controller.sendMessage(
      { sub: 'user-1' } as never,
      'chat-1',
      {
        type: 'IMAGE',
        text: null,
        fileId: '11111111-1111-4111-8111-111111111111',
        fileBucket: 'media',
        fileKey: 'chat/file.png',
        fileName: 'file.png',
        fileSize: 123,
        fileMime: 'image/png',
        fileCategory: 'IMAGE',
      } as never,
    );

    expect(ctx.chatClient.send).toHaveBeenCalledWith(
      CHAT_PATTERNS.SEND_MESSAGE,
      expect.objectContaining({ fileCategory: 'IMAGE' }),
    );
  });

  it('uses an explicit self-chat RPC pattern', async () => {
    const ctx = controller();
    await ctx.controller.createSelf({ sub: 'user-1' } as never);
    expect(ctx.chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.CREATE_SELF, { userId: 'user-1' });
  });

  it('uses an explicit mark-read RPC pattern', async () => {
    const ctx = controller();
    await ctx.controller.markRead({ sub: 'user-1' } as never, 'chat-1', { messageId: 'message-1' } as never);
    expect(ctx.chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.MARK_READ, {
      chatId: 'chat-1',
      userId: 'user-1',
      messageId: 'message-1',
    });
  });
});
```

- [ ] **Step 8: Run red Gateway tests**

Run: `npm exec nx test @org/gateway -- --runInBand controllers/chat.controller.spec.ts`

Expected: FAIL because `fileCategory` is missing and `createSelf` / `markRead` do not exist.

## Task 2: Implement Backend Self-Chat And Server Unread

**Files:**
- Modify all files listed in Task 1.
- Create migration under `libs/backend/chat/src/database/prisma/migrations/`.

**Interfaces:**
- Consumes tests from Task 1.
- Produces explicit self-chat and mark-read APIs used by Gateway/frontend tasks.

- [ ] **Step 1: Add Prisma read marker fields**

Modify `ChatMember`:

```prisma
model ChatMember {
  chatId            String   @map("chat_id")
  userId            String   @map("user_id")
  role              ChatRole @default(MEMBER) @map("role")
  joinedAt          DateTime @default(now()) @map("joined_at")
  lastReadMessageId String?  @map("last_read_message_id")
  lastReadAt        DateTime? @map("last_read_at")

  chat Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)

  @@id([chatId, userId])
  @@index([userId])
  @@index([chatId, lastReadAt])
}
```

Create `libs/backend/chat/src/database/prisma/migrations/20260714000000_add_chat_read_markers/migration.sql`:

```sql
ALTER TABLE "ChatMember"
  ADD COLUMN "last_read_message_id" TEXT,
  ADD COLUMN "last_read_at" TIMESTAMP(3);

CREATE INDEX "ChatMember_chat_id_last_read_at_idx"
  ON "ChatMember"("chat_id", "last_read_at");
```

- [ ] **Step 2: Update common schemas/select fields**

Add `libs/common/src/schemas/chat/read-chat.schema.ts`:

```ts
import * as z from 'zod';

export const markChatReadSchema = z.object({
  messageId: z.string().uuid().nullable().optional(),
});

export type MarkChatReadInput = z.infer<typeof markChatReadSchema>;
```

Export it from `libs/common/src/schemas/chat/index.ts`.

Add `lastReadMessageId` and `lastReadAt` to `chatMemberSchema` and `CHAT_MEMBER_SELECT_FIELDS`.

```ts
export const chatMemberSchema = z.object({
  chatId: z.uuid(),
  userId: z.uuid(),
  role: chatRoleSchema,
  joinedAt: z.date(),
  lastReadMessageId: z.string().uuid().nullable(),
  lastReadAt: z.date().nullable(),
});
```

- [ ] **Step 3: Update routes and patterns**

Add:

```ts
// libs/common/src/constants/routes.ts
self: 'chats/self',
read: (id: string) => `chats/${id}/read`,
```

```ts
// libs/backend/core/src/constants/queues/chat.queue.ts
CREATE_SELF: 'chat.createSelf',
MARK_READ: 'chat.markRead',
```

- [ ] **Step 4: Extend chat interfaces**

Add `unreadCount: number` to `ChatWithPreview`.

Add repository/service/controller methods:

```ts
markChatRead(chatId: string, userId: string, messageId?: string | null): Promise<ChatMember>;
countUnreadMessages(chatId: string, userId: string, lastReadAt?: Date | null): Promise<number>;
createSelfChat(userId: string): Promise<Chat>;
markRead(chatId: string, userId: string, messageId?: string | null): Promise<ChatMember>;
```

- [ ] **Step 5: Implement service behavior**

Change `getChats()` to:

```ts
async getChats(userId: string): Promise<ChatWithPreview[]> {
  return this.repo.findChatsForUser(userId);
}
```

Add:

```ts
async createSelfChat(userId: string): Promise<Chat> {
  return this.createDirectChat(userId, userId);
}

async markRead(chatId: string, userId: string, messageId?: string | null): Promise<ChatMember> {
  const member = await this.repo.findChatMember(chatId, userId);
  if (!member) throw new ForbiddenException('Not a member of this chat');
  return this.repo.markChatRead(chatId, userId, messageId ?? null);
}
```

- [ ] **Step 6: Implement repository behavior**

In `findChatsForUser`, select members with read markers and compute unread counts. Minimal implementation:

```ts
const unreadCount = await this.countUnreadMessages(chat.id, userId, ownMember?.lastReadAt ?? null);
```

In `countUnreadMessages`:

```ts
return this.prisma.message.count({
  where: {
    chatId,
    senderId: { not: userId },
    ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
  },
});
```

In `markChatRead`, if `messageId` exists, fetch message and use its `createdAt`; otherwise use latest message in chat or `new Date()`.

- [ ] **Step 7: Add RPC handlers**

Add to `libs/backend/chat/src/controllers/chat.controller.ts`:

```ts
@MessagePattern(CHAT_PATTERNS.CREATE_SELF)
createSelf(@Payload() payload: { userId: string }): Promise<Chat> {
  return this.chatService.createSelfChat(payload.userId);
}

@MessagePattern(CHAT_PATTERNS.MARK_READ)
markRead(@Payload() payload: { chatId: string; userId: string; messageId?: string | null }): Promise<ChatMember> {
  return this.chatService.markRead(payload.chatId, payload.userId, payload.messageId ?? null);
}
```

- [ ] **Step 8: Add Gateway endpoints and fix fileCategory**

Add:

```ts
@Post('self')
createSelf(@CurrentUser() user: JwtPayload) {
  return this.send(this.chatClient.send(CHAT_PATTERNS.CREATE_SELF, { userId: user.sub }));
}

@Post(':id/read')
@HttpCode(200)
markRead(
  @CurrentUser() user: JwtPayload,
  @Param('id') chatId: string,
  @Body() dto: { messageId?: string | null },
) {
  return this.send(this.chatClient.send(CHAT_PATTERNS.MARK_READ, {
    chatId,
    userId: user.sub,
    messageId: dto.messageId ?? null,
  }));
}
```

In existing `sendMessage`, include:

```ts
fileCategory: dto.fileCategory ?? null,
```

- [ ] **Step 9: Run green tests**

Run:

```bash
npm exec nx test @org/chat -- --runInBand services/chat.service.spec.ts controllers/chat.controller.spec.ts
npm exec nx test @org/gateway -- --runInBand controllers/chat.controller.spec.ts
```

Expected: PASS.

## Task 3: Backend Logging Tests And Implementation

**Files:**
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Modify: `apps/backend/gateway/src/controllers/chat.controller.ts`
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- Test: existing and new backend specs.

**Interfaces:**
- Consumes backend behavior from Task 2.
- Produces sanitized structured logs.

- [ ] **Step 1: Write failing no-PII log tests**

Add tests asserting logger payloads do not contain raw `user-secret-id`, `chat-secret-id`, `message text`, `file.png`, `token=secret`.

Use the existing pattern from `apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts`.

- [ ] **Step 2: Run red tests**

Run:

```bash
npm exec nx test @org/chat -- --runInBand services/chat.service.spec.ts controllers/chat.controller.spec.ts
npm exec nx test @org/gateway -- --runInBand controllers/chat.controller.spec.ts gateways/chat.socket-gateway.spec.ts
```

Expected: FAIL where new logger fields/methods do not exist or raw values are logged.

- [ ] **Step 3: Implement structured loggers**

Use `private readonly logger = new Logger(ChatService.name)` and structured payloads:

```ts
this.logger.log({ eventType: 'chat_list_requested', hasUserId: !!userId });
this.logger.debug({ eventType: 'message_send_requested', hasChatId: !!chatId, hasSenderId: !!senderId, type: input.type });
this.logger.warn({ eventType: 'chat_membership_denied', hasChatId: !!chatId, hasUserId: !!userId });
```

Do not include raw IDs or message text.

- [ ] **Step 4: Run green tests**

Run the same backend test commands.

Expected: PASS.

## Task 4: Frontend Server Unread And Self-Chat Integration

**Files:**
- Modify: `libs/client/entities/chat/src/chat.api.ts`
- Modify: `libs/client/entities/chat/src/chat.store.ts`
- Modify: `libs/client/entities/chat/src/use-chat-list.ts`
- Modify: `libs/client/features/chat-socket/src/use-chat-socket.ts`
- Modify: `apps/client/messenger/src/app/socket/chat-cache-updaters.ts`
- Test: app/library Jest specs.

**Interfaces:**
- Consumes Gateway endpoints `POST /api/chats/self` and `POST /api/chats/:id/read`.
- Produces frontend chat list unread sourced from server field `unreadCount`.

- [ ] **Step 1: Write failing tests for server unread mapping**

Update or add app-level Jest tests:

```ts
it('uses server unread count when mapping chat list items', () => {
  // Arrange chat with unreadCount: 3
  // Assert mapped item unread is 3 even when local UI cache is empty
});
```

- [ ] **Step 2: Write failing test for mark-read on chat join**

Mock `chatApi.markRead` and assert `useChatSocket('chat-1')` calls it when mounted.

- [ ] **Step 3: Run red frontend tests**

Run: `npm exec nx test @org/messenger -- --runInBand`

Expected: FAIL until API/store/hook are updated.

- [ ] **Step 4: Implement chat API**

Add:

```ts
createSelfChat: () => authedFetch<Chat>(API_ROUTES.chats.self, { method: 'POST' }),
markRead: (chatId: string, body: { messageId?: string | null } = {}) =>
  authedFetch(API_ROUTES.chats.read(chatId), {
    method: 'POST',
    body: JSON.stringify(body),
  }),
```

Add `unreadCount: number` to `Chat`.

- [ ] **Step 5: Update list mapping and store role**

Use:

```ts
unread: chat.unreadCount ?? unreadByChatId[chat.id] ?? 0,
```

Keep local store only for optimistic/display reconciliation, not source of truth.

- [ ] **Step 6: Update `useChatSocket`**

On mount:

```ts
void chatApi.markRead(chatId).catch(() => undefined);
markChatRead(chatId);
socket.emit('chat:join', { chatId });
```

- [ ] **Step 7: Run green frontend tests**

Run: `npm exec nx test @org/messenger -- --runInBand`

Expected: PASS.

## Task 5: Frontend Logging And Clean Console

**Files:**
- Modify: `libs/client/shared/src/ui/error-boundary/error-boundary.tsx`
- Modify: `apps/client/messenger/src/app/main.tsx`
- Modify: `apps/client/messenger/src/app/config/env.ts`
- Modify: `libs/client/features/send-message/src/use-send-message.ts`
- Modify: `libs/client/features/chat-socket/src/use-chat-socket.ts`
- Modify: `apps/client/messenger/src/app/socket/chat-socket-manager.ts`
- Test: `libs/client/shared/src/lib/hooks/use-logger.spec.tsx`, frontend component/app specs.

**Interfaces:**
- Consumes existing `useLogger` and `reportFrontendError`.
- Produces no direct prod/demo `console.*` outside logger.

- [ ] **Step 1: Write failing direct console grep test or lint-oriented test**

Add a Jest test or enforce with `rg` in verification:

```bash
rg -n "console\\." apps/client/messenger libs/client -g '!**/use-logger.ts' -g '!**/*.spec.*'
```

Expected before fix: finds direct console uses in `error-boundary.tsx`, `main.tsx`, `env.ts`.

- [ ] **Step 2: Write failing ErrorBoundary production test**

Assert `reportFrontendError` is called and `console.error` is not called when production flag is true.

- [ ] **Step 3: Replace direct console usage**

Move console behavior behind dev gate:

```ts
if (import.meta.env.DEV) {
  logger.error('SW registration failed', { hasError: !!err });
}
```

For non-hook files, create `libs/client/shared/src/lib/observability/frontend-logger.ts`:

```ts
type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

const isProduction = import.meta.env ? import.meta.env.PROD : false;

export function frontendLog(level: LogLevel, context: string, message: string, details?: Record<string, unknown>): void {
  if (isProduction) return;
  const method = level === 'verbose' ? 'debug' : level;
  // eslint-disable-next-line no-console
  console[method](`[React] [${context}] ${message}`, details ?? {});
}
```

Then make `useLogger` call this helper so `console.*` stays centralized.

- [ ] **Step 4: Add chat flow logger calls**

Add sanitized logs:

```ts
logger.debug('message_send_requested', { hasChatId: !!chatIdRef.current, hasText: !!trimmed });
logger.debug('chat_join_requested', { hasChatId: !!chatId });
logger.debug('message_received', { hasChatId: !!msg.chatId, hasMessageId: !!msg.id });
```

Do not log text, raw ids or file names.

- [ ] **Step 5: Run green tests and grep**

Run:

```bash
npm exec nx test @org/messenger -- --runInBand
rg -n "console\\." apps/client/messenger libs/client -g '!**/use-logger.ts' -g '!**/*.spec.*'
```

Expected: tests PASS; grep returns no direct production code console usage.

## Task 6: Playwright Chat Flow And Production Clean Console

**Files:**
- Create: `apps/client/messenger/e2e/chat-message-flow.spec.ts`
- Modify: existing e2e mocks if shared helpers are extracted.

**Interfaces:**
- Consumes frontend/server contracts from Tasks 2 and 4.
- Produces E2E coverage for text send, incoming message, unread and clean console.

- [ ] **Step 1: Write failing Playwright send-flow test**

Create test that:

1. routes session/user/chat/message APIs;
2. opens `/chats/chat-1`;
3. fills `Write a message...`;
4. presses Enter;
5. emits `message:new` through the app socket mock with the created message payload;
6. asserts message visible and composer cleared.

- [ ] **Step 2: Write failing unread test**

Route `GET /api/chats` with inactive chat `unreadCount: 2`; assert badge `2`. Open chat; assert `POST /api/chats/chat-1/read` is called and badge clears after updated route/socket state.

- [ ] **Step 3: Write production clean console smoke**

Use Playwright `page.on('console')` and fail on error/warn/log for production preview, allowing known browser extension noise only if observed and documented in test.

- [ ] **Step 4: Run red E2E**

Run: `npm exec nx run @org/messenger:e2e-ci--e2e/chat-message-flow.spec.ts`

Expected: FAIL until frontend behavior/mocks are complete.

- [ ] **Step 5: Implement minimal UI/test support**

Add stable test IDs only where necessary:

```tsx
<Textarea data-testid="chat-composer" ... />
```

Do not add test-only production APIs.

- [ ] **Step 6: Run green E2E**

Run: `npm exec nx run @org/messenger:e2e-ci--e2e/chat-message-flow.spec.ts`

Expected: PASS.

## Task 7: Swagger And Development Documentation

**Files:**
- Modify: `apps/backend/gateway/src/controllers/chat.controller.ts`
- Modify: `docs/DEVELOPMENT.md`
- Modify: `docs/OBSERVABILITY.md`
- Modify: `docs/specs/chat-service.md`
- Modify: `docs/specs/client-messenger.md`

**Interfaces:**
- Consumes tested final contracts.
- Produces docs that match implementation.

- [ ] **Step 1: Update Swagger decorators**

Add `@ApiOperation`, `@ApiResponse`, `@ApiBody`, `@ApiQuery` for:

- `POST /chats/self`
- `GET /chats`
- `POST /chats/:id/read`
- `POST /chats/:id/messages` including `fileCategory`
- `GET /chats/:id/media/messages`
- `POST /chats/:id/forward`

- [ ] **Step 2: Add or update Swagger tests**

Follow `apps/backend/gateway/src/controllers/auth.swagger.spec.ts`; assert chat paths and schema examples exist.

- [ ] **Step 3: Update development docs**

Add sections:

- frontend logging standard;
- backend logging standard;
- Swagger standard;
- chat testing matrix and Nx commands.

- [ ] **Step 4: Rewrite chat/client specs**

Ensure specs say:

- unread is server-side;
- self-chat is explicit idempotent action;
- `GET /chats` has no write side effects;
- Socket.IO and HTTP message contracts match;
- edit/delete/search/groups/calls are out of MVP unless implemented later.

- [ ] **Step 5: Run docs-adjacent verification**

Run:

```bash
npm exec nx test @org/gateway -- --runInBand controllers/auth.swagger.spec.ts controllers/chat.controller.spec.ts
rg -n "local unread|временный frontend MVP|GET /chats.*созда" docs/specs docs/DEVELOPMENT.md docs/OBSERVABILITY.md
```

Expected: tests PASS; grep finds no stale contradiction.

## Final Verification

- [ ] **Step 1: Run backend tests**

```bash
npm exec nx test @org/chat
npm exec nx test @org/gateway
```

- [ ] **Step 2: Run frontend tests**

```bash
npm exec nx test @org/messenger
```

- [ ] **Step 3: Run E2E**

```bash
npm exec nx e2e @org/messenger
```

- [ ] **Step 4: Run lint/typecheck for touched projects**

```bash
npm exec nx lint @org/chat
npm exec nx lint @org/gateway
npm exec nx lint @org/messenger
npm exec nx typecheck @org/chat
npm exec nx typecheck @org/gateway
npm exec nx typecheck @org/messenger
```

- [ ] **Step 5: Verify no direct frontend console usage**

```bash
rg -n "console\\." apps/client/messenger libs/client -g '!**/use-logger.ts' -g '!**/*.spec.*'
```

Expected: no output.

## Completion Status

- Выполнено: initial audit created.
- Выполнено: user decisions incorporated into audit: server unread, explicit self-chat, B7 clarified.
- Выполнено: implementation plan created.
- Не выполнено: production code changes.
- Не выполнено: tests implementation.
- Не выполнено: Swagger/docs rewrite.
