# Message Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add message edit, delete-for-me/delete-for-everyone, forward-to modal, and copy actions to chat messages.

**Architecture:** Extend shared schemas first, then add backend persistence/service behavior, gateway HTTP/socket integration, client entity APIs/cache helpers, and page-level UI. Deleted messages are removed from render streams, not shown as placeholders. Forwarding reuses the existing backend `forwardMessages` flow and adds the missing client experience.

**Tech Stack:** Nx, TypeScript, NestJS, Prisma, RabbitMQ ClientProxy, Socket.IO, React 19, TanStack Query, Jest, Testing Library.

## Global Constraints

- Work directly on `dev`; do not create or use a `chat-system-hardening` branch.
- Use Nx through `env NX_ISOLATE_PLUGINS=false npm exec nx -- ...`.
- Use TDD: write failing tests before implementation code.
- Edit only own text-only messages: `type === 'TEXT'`, no `fileId`, non-empty trimmed text, max 4000 characters.
- File messages, media messages, voice/audio messages, and file captions are not editable.
- Deleted messages do not render as placeholders; remove them from history, media history, and open message lists.
- Delete confirmation has one `Delete` menu action; own messages default to checked `Delete for everyone`, unchecked means delete only for me.
- Forward modal title is `Forward to...`; first row is `Saved Messages`.
- Do not log raw ids, message text, file names, tokens, cookies, or signed URLs.
- Respect existing dirty worktree changes; do not revert unrelated files.

---

## File Map

- `libs/common/src/schemas/chat/message.schema.ts`: add edit/delete metadata to shared message schema.
- `libs/common/src/schemas/chat/edit-message.schema.ts`: new edit body schema.
- `libs/common/src/schemas/chat/delete-message.schema.ts`: new delete body schema.
- `libs/common/src/schemas/chat/index.ts`: export new schemas.
- `libs/common/src/constants/routes.ts`: add message edit/delete/forward routes.
- `libs/backend/chat/src/dto/edit-message.dto.ts`: Nest DTO from shared schema.
- `libs/backend/chat/src/dto/delete-message.dto.ts`: Nest DTO from shared schema.
- `libs/backend/chat/src/dto/index.ts`: export DTOs.
- `libs/backend/chat/src/database/prisma/schema.prisma`: add edit/delete fields and `MessageDeletion`.
- `libs/backend/chat/src/database/prisma/migrations/20260722010000_add_message_actions/migration.sql`: add SQL migration.
- `libs/backend/chat/src/interfaces/chat.interface.ts`: add repository/service method contracts.
- `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`: implement edit/delete/filter persistence.
- `libs/backend/chat/src/database/repository/chat.prisma.repo.spec.ts`: repository red/green coverage.
- `libs/backend/chat/src/services/chat.service.ts`: implement authorization/business rules/logging.
- `libs/backend/chat/src/services/chat.service.spec.ts`: service red/green coverage.
- `libs/backend/core/src/constants/queues/chat.queue.ts`: add edit/delete patterns.
- `libs/backend/chat/src/controllers/chat.controller.ts`: add RMQ handlers.
- `apps/backend/gateway/src/controllers/chat.controller.ts`: add HTTP routes and broadcasts.
- `apps/backend/gateway/src/controllers/chat.controller.spec.ts`: gateway red/green coverage.
- `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`: add `broadcastMessageUpdated`, `broadcastMessageDeleted`, `emitToUser`.
- `apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts`: socket helper coverage.
- `libs/client/entities/message/src/message.types.ts`: add metadata types.
- `libs/client/entities/message/src/message-normalizer.ts`: normalize metadata.
- `libs/client/entities/message/src/message.api.ts`: add edit/delete/forward API and mutations.
- `libs/client/entities/message/src/message-cache.ts`: new cache helper module.
- `apps/client/messenger/src/app/message-actions-cache.spec.ts`: cache helper coverage through app Jest.
- `libs/client/entities/message/src/ui/message-bubble.tsx`: show edited marker and action slot.
- `libs/client/entities/message/src/ui/message-actions-menu.tsx`: new menu component.
- `libs/client/entities/message/src/ui/message-actions-menu.spec.tsx`: menu visibility tests.
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx`: add edit mode support.
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/chat-window.tsx`: wire edit state from message list to footer.
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`: pass action handlers and remove messages on socket events.
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/delete-message-modal.tsx`: new delete confirmation modal.
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/forward-message-modal.tsx`: new forward target modal.
- `apps/client/messenger/src/app/message-actions-ui.spec.tsx`: UI integration coverage.
- `apps/client/messenger/src/app/socket/chat-cache-updaters.ts`: add update/remove helpers for socket events.
- `apps/client/messenger/src/app/socket/chat-socket-manager.ts`: subscribe to `message:updated`, `message:deleted`, `message:hidden`.
- `apps/client/messenger/src/app/socket/chat-cache-updaters.spec.ts`: socket cache coverage.

---

### Task 1: Shared Schemas And Routes

**Files:**
- Modify: `libs/common/src/schemas/chat/message.schema.ts`
- Create: `libs/common/src/schemas/chat/edit-message.schema.ts`
- Create: `libs/common/src/schemas/chat/delete-message.schema.ts`
- Modify: `libs/common/src/schemas/chat/index.ts`
- Modify: `libs/common/src/constants/routes.ts`
- Test: `libs/common/src/schemas/chat/message-actions.schema.spec.ts`

**Interfaces:**
- Produces: `editMessageSchema`, `EditMessageInput`, `deleteMessageSchema`, `DeleteMessageInput`.
- Produces: `API_ROUTES.chats.message(chatId, messageId)` and `API_ROUTES.chats.forward(chatId)`.

- [ ] **Step 1: Write failing schema and route tests**

Create `libs/common/src/schemas/chat/message-actions.schema.spec.ts`:

```ts
import { API_ROUTES } from '../../constants/routes';
import { deleteMessageSchema } from './delete-message.schema';
import { editMessageSchema } from './edit-message.schema';
import { messageSchema } from './message.schema';

describe('message action schemas', () => {
  it('trims edited text and rejects empty edits', () => {
    expect(editMessageSchema.parse({ text: '  hello  ' })).toEqual({ text: 'hello' });
    expect(() => editMessageSchema.parse({ text: '   ' })).toThrow();
  });

  it('accepts only supported delete modes', () => {
    expect(deleteMessageSchema.parse({ mode: 'ME' })).toEqual({ mode: 'ME' });
    expect(deleteMessageSchema.parse({ mode: 'EVERYONE' })).toEqual({ mode: 'EVERYONE' });
    expect(() => deleteMessageSchema.parse({ mode: 'CHAT' })).toThrow();
  });

  it('includes edit and delete metadata on messages', () => {
    const createdAt = new Date('2026-07-22T00:00:00.000Z');
    expect(
      messageSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        clientId: null,
        chatId: '22222222-2222-4222-8222-222222222222',
        senderId: '33333333-3333-4333-8333-333333333333',
        type: 'TEXT',
        text: 'hello',
        fileId: null,
        fileBucket: null,
        fileKey: null,
        fileName: null,
        fileSize: null,
        fileMime: null,
        fileCategory: null,
        forwardedFromId: null,
        editedAt: null,
        deletedAt: null,
        deletedById: null,
        createdAt,
        updatedAt: createdAt,
      }),
    ).toMatchObject({ editedAt: null, deletedAt: null, deletedById: null });
  });

  it('builds message action routes', () => {
    expect(API_ROUTES.chats.message('chat-1', 'msg-1')).toBe('chats/chat-1/messages/msg-1');
    expect(API_ROUTES.chats.forward('chat-1')).toBe('chats/chat-1/forward');
  });
});
```

- [ ] **Step 2: Run red common tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/common -- --runInBand --runTestsByPath src/schemas/chat/message-actions.schema.spec.ts
```

Expected: FAIL because `edit-message.schema`, `delete-message.schema`, message metadata, and routes do not exist.

- [ ] **Step 3: Implement schemas and routes**

Create `libs/common/src/schemas/chat/edit-message.schema.ts`:

```ts
import * as z from 'zod';

export const editMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;
```

Create `libs/common/src/schemas/chat/delete-message.schema.ts`:

```ts
import * as z from 'zod';

export const deleteMessageSchema = z.object({
  mode: z.enum(['ME', 'EVERYONE']),
});

export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;
```

Update `messageSchema` with:

```ts
  editedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
  deletedById: z.string().uuid().nullable(),
```

Update `libs/common/src/schemas/chat/index.ts`:

```ts
export * from './edit-message.schema';
export * from './delete-message.schema';
```

Update `API_ROUTES.chats`:

```ts
message: (chatId: string, messageId: string) => `chats/${chatId}/messages/${messageId}`,
forward: (id: string) => `chats/${id}/forward`,
```

- [ ] **Step 4: Run green common tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/common -- --runInBand --runTestsByPath src/schemas/chat/message-actions.schema.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/common/src/schemas/chat/message.schema.ts libs/common/src/schemas/chat/edit-message.schema.ts libs/common/src/schemas/chat/delete-message.schema.ts libs/common/src/schemas/chat/index.ts libs/common/src/constants/routes.ts libs/common/src/schemas/chat/message-actions.schema.spec.ts
git commit -m "feat(common): add message action schemas"
```

---

### Task 2: Chat Persistence For Edit And Delete

**Files:**
- Modify: `libs/backend/chat/src/database/prisma/schema.prisma`
- Create: `libs/backend/chat/src/database/prisma/migrations/20260722010000_add_message_actions/migration.sql`
- Modify: `libs/backend/chat/src/interfaces/chat.interface.ts`
- Modify: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`
- Test: `libs/backend/chat/src/database/repository/chat.prisma.repo.spec.ts`

**Interfaces:**
- Consumes: shared message fields from Task 1.
- Produces: repository methods:
  - `updateMessageText(messageId: string, text: string): Promise<Message>`
  - `deleteMessageForEveryone(messageId: string, userId: string): Promise<Message>`
  - `hideMessageForUser(messageId: string, userId: string): Promise<void>`

- [ ] **Step 1: Write failing repository tests**

Append to `chat.prisma.repo.spec.ts` tests named:

```ts
it('filters globally deleted and user-hidden messages from chat history', async () => {
  const visible = await repo.createMessage({ chatId, senderId: userId, type: 'TEXT', text: 'visible' });
  const hidden = await repo.createMessage({ chatId, senderId: userId, type: 'TEXT', text: 'hidden' });
  const deleted = await repo.createMessage({ chatId, senderId: userId, type: 'TEXT', text: 'deleted' });

  await repo.hideMessageForUser(hidden.id, userId);
  await repo.deleteMessageForEveryone(deleted.id, userId);

  const page = await repo.findMessagesByChat(chatId, undefined, 50, userId);

  expect(page.messages.map((message) => message.id)).toContain(visible.id);
  expect(page.messages.map((message) => message.id)).not.toContain(hidden.id);
  expect(page.messages.map((message) => message.id)).not.toContain(deleted.id);
});

it('updates text and editedAt without changing file fields', async () => {
  const message = await repo.createMessage({ chatId, senderId: userId, type: 'TEXT', text: 'before' });

  const updated = await repo.updateMessageText(message.id, 'after');

  expect(updated.text).toBe('after');
  expect(updated.editedAt).toBeInstanceOf(Date);
  expect(updated.fileId).toBeNull();
});
```

If the current test setup uses different fixture names, use the existing `chatId` and `userId` fixture variables from that file and keep the assertions exactly equivalent.

- [ ] **Step 2: Run red repository tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat -- --runInBand --runTestsByPath src/database/repository/chat.prisma.repo.spec.ts
```

Expected: FAIL because repository signatures and schema fields are missing.

- [ ] **Step 3: Add Prisma schema and migration**

In `Message` add:

```prisma
  editedAt        DateTime?   @map("edited_at")
  deletedAt       DateTime?   @map("deleted_at")
  deletedById     String?     @map("deleted_by_id")
  deletions       MessageDeletion[]
```

Add model:

```prisma
model MessageDeletion {
  messageId String   @map("message_id")
  userId    String   @map("user_id")
  deletedAt DateTime @default(now()) @map("deleted_at")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@id([messageId, userId])
  @@index([userId])
  @@map("message_deletions")
}
```

Create migration SQL:

```sql
ALTER TABLE "Message" ADD COLUMN "edited_at" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deleted_by_id" TEXT;

CREATE TABLE "message_deletions" (
  "message_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_deletions_pkey" PRIMARY KEY ("message_id", "user_id"),
  CONSTRAINT "message_deletions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "message_deletions_user_id_idx" ON "message_deletions"("user_id");
CREATE INDEX "Message_deleted_at_idx" ON "Message"("deleted_at");
```

- [ ] **Step 4: Extend repository contracts and selects**

Update `IChatRepository.findMessagesByChat` and `findMediaMessagesByChat` to accept `userId: string`.

Add methods:

```ts
updateMessageText(messageId: string, text: string): Promise<Message>;
deleteMessageForEveryone(messageId: string, userId: string): Promise<Message>;
hideMessageForUser(messageId: string, userId: string): Promise<void>;
```

Update `MESSAGE_SELECT_FIELDS` in `libs/common/src/schemas/chat/chat-select.ts` to include:

```ts
editedAt: true,
deletedAt: true,
deletedById: true,
```

- [ ] **Step 5: Implement repository methods and filtering**

For message history queries, add:

```ts
where: {
  chatId,
  deletedAt: null,
  deletions: { none: { userId } },
}
```

For media history, merge the existing media where with:

```ts
deletedAt: null,
deletions: { none: { userId } },
```

Add:

```ts
async updateMessageText(messageId: string, text: string): Promise<Message> {
  try {
    return await this.prisma.message.update({
      where: { id: messageId },
      data: { text, editedAt: new Date() },
      select: MESSAGE_SELECT_FIELDS,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

async deleteMessageForEveryone(messageId: string, userId: string): Promise<Message> {
  try {
    return await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), deletedById: userId },
      select: MESSAGE_SELECT_FIELDS,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

async hideMessageForUser(messageId: string, userId: string): Promise<void> {
  try {
    await this.prisma.messageDeletion.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId },
      update: { deletedAt: new Date() },
    });
  } catch (error) {
    handlePrismaError(error);
  }
}
```

- [ ] **Step 6: Run green repository tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/chat:prisma-generate
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat -- --runInBand --runTestsByPath src/database/repository/chat.prisma.repo.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/backend/chat/src/database/prisma/schema.prisma libs/backend/chat/src/database/prisma/migrations/20260722010000_add_message_actions/migration.sql libs/backend/chat/src/interfaces/chat.interface.ts libs/backend/chat/src/database/repository/chat.prisma.repo.ts libs/backend/chat/src/database/repository/chat.prisma.repo.spec.ts libs/common/src/schemas/chat/chat-select.ts
git commit -m "feat(chat): persist message actions"
```

---

### Task 3: Chat Service Business Rules

**Files:**
- Modify: `libs/backend/chat/src/interfaces/chat.interface.ts`
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Test: `libs/backend/chat/src/services/chat.service.spec.ts`

**Interfaces:**
- Consumes: repository methods from Task 2.
- Produces:
  - `editMessage(chatId: string, messageId: string, userId: string, text: string): Promise<Message>`
  - `deleteMessage(chatId: string, messageId: string, userId: string, mode: 'ME' | 'EVERYONE'): Promise<Message | { id: string; chatId: string }>`

- [ ] **Step 1: Write failing service tests**

Add tests:

```ts
it('edits only own text messages without files', async () => {
  repo.findChatMember.mockResolvedValue({ chatId: 'chat-1', userId: 'user-1' });
  repo.findMessageById.mockResolvedValue({
    id: 'msg-1',
    chatId: 'chat-1',
    senderId: 'user-1',
    type: 'TEXT',
    text: 'before',
    fileId: null,
    deletedAt: null,
  });
  repo.updateMessageText.mockResolvedValue({ id: 'msg-1', chatId: 'chat-1', text: 'after' });

  await expect(service.editMessage('chat-1', 'msg-1', 'user-1', 'after')).resolves.toMatchObject({
    id: 'msg-1',
    text: 'after',
  });
});

it('rejects editing file-backed messages', async () => {
  repo.findChatMember.mockResolvedValue({ chatId: 'chat-1', userId: 'user-1' });
  repo.findMessageById.mockResolvedValue({
    id: 'msg-1',
    chatId: 'chat-1',
    senderId: 'user-1',
    type: 'TEXT',
    text: 'caption',
    fileId: 'file-1',
    deletedAt: null,
  });

  await expect(service.editMessage('chat-1', 'msg-1', 'user-1', 'after')).rejects.toThrow();
});

it('defaults delete-for-everyone authorization to sender only', async () => {
  repo.findChatMember.mockResolvedValue({ chatId: 'chat-1', userId: 'user-2' });
  repo.findMessageById.mockResolvedValue({
    id: 'msg-1',
    chatId: 'chat-1',
    senderId: 'user-1',
    type: 'TEXT',
    text: 'hello',
    fileId: null,
    deletedAt: null,
  });

  await expect(service.deleteMessage('chat-1', 'msg-1', 'user-2', 'EVERYONE')).rejects.toThrow();
});
```

Use the existing mock style in `chat.service.spec.ts`; preserve the behavior asserted above.

- [ ] **Step 2: Run red service tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat -- --runInBand --runTestsByPath src/services/chat.service.spec.ts
```

Expected: FAIL because service methods do not exist.

- [ ] **Step 3: Implement service contracts**

Add to `IChatService`:

```ts
editMessage(chatId: string, messageId: string, userId: string, text: string): Promise<Message>;
deleteMessage(
  chatId: string,
  messageId: string,
  userId: string,
  mode: 'ME' | 'EVERYONE',
): Promise<Message | { id: string; chatId: string }>;
```

- [ ] **Step 4: Implement edit and delete**

In `ChatService`, add:

```ts
async editMessage(chatId: string, messageId: string, userId: string, text: string): Promise<Message> {
  this.logger.log({ eventType: 'message_edit_requested', hasChatId: !!chatId, hasMessageId: !!messageId, hasUserId: !!userId });
  await this.requireMember(chatId, userId);
  const message = await this.requireMessageInChat(chatId, messageId);

  if (message.senderId !== userId || message.type !== 'TEXT' || message.fileId || message.deletedAt) {
    this.logger.warn({ eventType: 'message_edit_rejected', hasChatId: true, hasMessageId: true, hasUserId: true });
    throw new ForbiddenException('Message cannot be edited');
  }

  const updated = await this.repo.updateMessageText(messageId, text);
  this.logger.log({ eventType: 'message_edited', hasChatId: true, hasMessageId: true, hasUserId: true });
  return updated;
}

async deleteMessage(
  chatId: string,
  messageId: string,
  userId: string,
  mode: 'ME' | 'EVERYONE',
): Promise<Message | { id: string; chatId: string }> {
  this.logger.log({ eventType: 'message_delete_requested', hasChatId: !!chatId, hasMessageId: !!messageId, hasUserId: !!userId, mode });
  await this.requireMember(chatId, userId);
  const message = await this.requireMessageInChat(chatId, messageId);

  if (mode === 'EVERYONE') {
    if (message.senderId !== userId) {
      this.logger.warn({ eventType: 'message_delete_rejected', hasChatId: true, hasMessageId: true, hasUserId: true, mode });
      throw new ForbiddenException('Only the sender can delete this message for everyone');
    }
    const deleted = await this.repo.deleteMessageForEveryone(messageId, userId);
    this.logger.log({ eventType: 'message_deleted_for_everyone', hasChatId: true, hasMessageId: true, hasUserId: true });
    return deleted;
  }

  await this.repo.hideMessageForUser(messageId, userId);
  this.logger.log({ eventType: 'message_deleted_for_user', hasChatId: true, hasMessageId: true, hasUserId: true });
  return { id: messageId, chatId };
}
```

Add private helpers:

```ts
private async requireMember(chatId: string, userId: string): Promise<void> {
  const member = await this.repo.findChatMember(chatId, userId);
  if (!member) throw new ForbiddenException('Not a member of this chat');
}

private async requireMessageInChat(chatId: string, messageId: string): Promise<Message> {
  const message = await this.repo.findMessageById(messageId);
  if (!message || message.chatId !== chatId) throw new NotFoundException('Message not found');
  return message;
}
```

Update `getMessages` and `getMediaMessages` repository calls to pass `userId`.

- [ ] **Step 5: Run green service tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat -- --runInBand --runTestsByPath src/services/chat.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/backend/chat/src/interfaces/chat.interface.ts libs/backend/chat/src/services/chat.service.ts libs/backend/chat/src/services/chat.service.spec.ts
git commit -m "feat(chat): enforce message action rules"
```

---

### Task 4: Gateway HTTP And Socket Events

**Files:**
- Modify: `libs/backend/core/src/constants/queues/chat.queue.ts`
- Create: `libs/backend/chat/src/dto/edit-message.dto.ts`
- Create: `libs/backend/chat/src/dto/delete-message.dto.ts`
- Modify: `libs/backend/chat/src/dto/index.ts`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- Modify: `apps/backend/gateway/src/controllers/chat.controller.ts`
- Test: `apps/backend/gateway/src/controllers/chat.controller.spec.ts`
- Test: `apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts`

**Interfaces:**
- Consumes: `ChatService.editMessage`, `ChatService.deleteMessage`.
- Produces: `PATCH /chats/:id/messages/:messageId`, `DELETE /chats/:id/messages/:messageId`, socket events `message:updated`, `message:deleted`, `message:hidden`.

- [ ] **Step 1: Write failing gateway tests**

Add controller tests:

```ts
it('patches a message and broadcasts message:updated', async () => {
  chatClient.send.mockReturnValue(of({ id: 'msg-1', chatId: 'chat-1', text: 'after' }));

  await request(app.getHttpServer())
    .patch('/chats/chat-1/messages/msg-1')
    .send({ text: 'after' })
    .expect(200);

  expect(chatClient.send).toHaveBeenCalledWith(CHAT_PATTERNS.EDIT_MESSAGE, {
    chatId: 'chat-1',
    messageId: 'msg-1',
    userId: 'user-1',
    text: 'after',
  });
  expect(socketGateway.broadcastMessageUpdated).toHaveBeenCalledWith('chat-1', expect.objectContaining({ id: 'msg-1' }));
});

it('deletes a message for the current user and emits message:hidden to that user', async () => {
  chatClient.send.mockReturnValue(of({ id: 'msg-1', chatId: 'chat-1' }));

  await request(app.getHttpServer())
    .delete('/chats/chat-1/messages/msg-1')
    .send({ mode: 'ME' })
    .expect(200);

  expect(socketGateway.emitToUser).toHaveBeenCalledWith('user-1', 'message:hidden', {
    chatId: 'chat-1',
    messageId: 'msg-1',
  });
});
```

Use the existing authenticated test helper in `chat.controller.spec.ts`; keep payloads and expectations equivalent.

- [ ] **Step 2: Write failing socket helper tests**

Add to `chat.socket-gateway.spec.ts`:

```ts
it('broadcasts updated and deleted message events to a chat room', () => {
  gateway.broadcastMessageUpdated('chat-1', { id: 'msg-1' });
  gateway.broadcastMessageDeleted('chat-1', 'msg-1');

  expect(server.to).toHaveBeenCalledWith('chat:chat-1');
  expect(room.emit).toHaveBeenCalledWith('message:updated', { id: 'msg-1' });
  expect(room.emit).toHaveBeenCalledWith('message:deleted', { chatId: 'chat-1', messageId: 'msg-1' });
});
```

- [ ] **Step 3: Run red gateway tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway -- --runInBand --runTestsByPath src/controllers/chat.controller.spec.ts src/gateways/chat.socket-gateway.spec.ts
```

Expected: FAIL because endpoints, patterns, DTOs, and socket helpers do not exist.

- [ ] **Step 4: Add patterns, DTOs, and RMQ handlers**

Add patterns:

```ts
EDIT_MESSAGE: 'chat.editMessage',
DELETE_MESSAGE: 'chat.deleteMessage',
```

Create DTOs:

```ts
import { editMessageSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class EditMessageDto extends createZodDto(editMessageSchema) {}
```

```ts
import { deleteMessageSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class DeleteMessageDto extends createZodDto(deleteMessageSchema) {}
```

Add chat-service controller handlers that call `chatService.editMessage(...)` and `chatService.deleteMessage(...)`.

- [ ] **Step 5: Add gateway routes and socket helpers**

In `ChatSocketGateway` add:

```ts
broadcastMessageUpdated(chatId: string, message: unknown): void {
  this.server.to(`chat:${chatId}`).emit('message:updated', message);
}

broadcastMessageDeleted(chatId: string, messageId: string): void {
  this.server.to(`chat:${chatId}`).emit('message:deleted', { chatId, messageId });
}

emitToUser(userId: string, event: string, payload: unknown): void {
  const sockets = this.userSockets.get(userId);
  if (!sockets) return;
  for (const socketId of sockets) {
    this.server.to(socketId).emit(event, payload);
  }
}
```

In gateway controller add:

```ts
@Patch(':id/messages/:messageId')
async editMessage(@CurrentUser() user: JwtPayload, @Param('id') chatId: string, @Param('messageId') messageId: string, @Body() dto: EditMessageDto) {
  const message = await this.send(this.chatClient.send(CHAT_PATTERNS.EDIT_MESSAGE, { chatId, messageId, userId: user.sub, text: dto.text }));
  this.socketGateway.broadcastMessageUpdated(chatId, message);
  return message;
}

@Delete(':id/messages/:messageId')
@HttpCode(200)
async deleteMessage(@CurrentUser() user: JwtPayload, @Param('id') chatId: string, @Param('messageId') messageId: string, @Body() dto: DeleteMessageDto) {
  const result = await this.send<{ id: string; chatId: string }>(this.chatClient.send(CHAT_PATTERNS.DELETE_MESSAGE, { chatId, messageId, userId: user.sub, mode: dto.mode }));
  if (dto.mode === 'EVERYONE') {
    this.socketGateway.broadcastMessageDeleted(chatId, messageId);
  } else {
    this.socketGateway.emitToUser(user.sub, 'message:hidden', { chatId, messageId });
  }
  return result;
}
```

- [ ] **Step 6: Run green gateway tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway -- --runInBand --runTestsByPath src/controllers/chat.controller.spec.ts src/gateways/chat.socket-gateway.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/backend/core/src/constants/queues/chat.queue.ts libs/backend/chat/src/dto/edit-message.dto.ts libs/backend/chat/src/dto/delete-message.dto.ts libs/backend/chat/src/dto/index.ts libs/backend/chat/src/controllers/chat.controller.ts apps/backend/gateway/src/gateways/chat.socket-gateway.ts apps/backend/gateway/src/controllers/chat.controller.ts apps/backend/gateway/src/controllers/chat.controller.spec.ts apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts
git commit -m "feat(gateway): expose message actions"
```

---

### Task 5: Client Message API And Cache Helpers

**Files:**
- Modify: `libs/client/entities/message/src/message.types.ts`
- Modify: `libs/client/entities/message/src/message-normalizer.ts`
- Modify: `libs/client/entities/message/src/message.api.ts`
- Create: `libs/client/entities/message/src/message-cache.ts`
- Modify: `libs/client/entities/message/src/index.ts`
- Test: `apps/client/messenger/src/app/message-actions-cache.spec.ts`

**Interfaces:**
- Produces:
  - `messageApi.editMessage(chatId, messageId, text): Promise<Message>`
  - `messageApi.deleteMessage(chatId, messageId, mode): Promise<{ id: string; chatId: string }>`
  - `messageApi.forwardMessages(targetChatId, input): Promise<Message[]>`
  - `updateMessageInPages(old, message)`
  - `removeMessageFromPages(old, messageId)`

- [ ] **Step 1: Write failing cache/API tests**

Create `apps/client/messenger/src/app/message-actions-cache.spec.ts`:

```ts
import { removeMessageFromPages, updateMessageInPages } from '@org/entities-message';

describe('message action cache helpers', () => {
  const old = {
    pageParams: [undefined],
    pages: [
      {
        nextCursor: null,
        messages: [
          { id: 'msg-1', chatId: 'chat-1', text: 'before', updatedAt: '2026-07-22T00:00:00.000Z' },
          { id: 'msg-2', chatId: 'chat-1', text: 'keep', updatedAt: '2026-07-22T00:00:00.000Z' },
        ],
      },
    ],
  };

  it('updates a message in infinite pages', () => {
    const next = updateMessageInPages(old, {
      id: 'msg-1',
      chatId: 'chat-1',
      text: 'after',
      updatedAt: '2026-07-22T00:01:00.000Z',
    });

    expect(next?.pages[0].messages[0]).toMatchObject({ id: 'msg-1', text: 'after' });
  });

  it('removes a message from infinite pages', () => {
    const next = removeMessageFromPages(old, 'msg-1');

    expect(next?.pages[0].messages.map((message) => message.id)).toEqual(['msg-2']);
  });
});
```

- [ ] **Step 2: Run red client cache tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/message-actions-cache.spec.ts
```

Expected: FAIL because helpers are not exported.

- [ ] **Step 3: Implement metadata normalization**

Add to raw/client types:

```ts
editedAt: string | null;
deletedAt: string | null;
deletedById: string | null;
```

Update normalizer to return:

```ts
editedAt: raw.editedAt ?? null,
deletedAt: raw.deletedAt ?? null,
deletedById: raw.deletedById ?? null,
```

- [ ] **Step 4: Implement API and cache helpers**

Create `message-cache.ts`:

```ts
type MessagePageLike<TMessage extends { id: string }> = { messages: TMessage[] };

export function updateMessageInPages<TData extends { pages: TPage[] }, TPage extends MessagePageLike<TMessage>, TMessage extends { id: string }>(
  old: TData | undefined,
  message: Partial<TMessage> & { id: string },
): TData | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      messages: page.messages.map((current) =>
        current.id === message.id ? ({ ...current, ...message } as TMessage) : current,
      ),
    })),
  };
}

export function removeMessageFromPages<TData extends { pages: TPage[] }, TPage extends MessagePageLike<TMessage>, TMessage extends { id: string }>(
  old: TData | undefined,
  messageId: string,
): TData | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((message) => message.id !== messageId),
    })),
  };
}
```

Add API methods using `API_ROUTES.chats.message` and `API_ROUTES.chats.forward`.

- [ ] **Step 5: Run green client cache tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/message-actions-cache.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/client/entities/message/src/message.types.ts libs/client/entities/message/src/message-normalizer.ts libs/client/entities/message/src/message.api.ts libs/client/entities/message/src/message-cache.ts libs/client/entities/message/src/index.ts apps/client/messenger/src/app/message-actions-cache.spec.ts
git commit -m "feat(client): add message action api"
```

---

### Task 6: Socket Cache Updates

**Files:**
- Modify: `apps/client/messenger/src/app/socket/chat-cache-updaters.ts`
- Modify: `apps/client/messenger/src/app/socket/chat-socket-manager.ts`
- Test: `apps/client/messenger/src/app/socket/chat-cache-updaters.spec.ts`

**Interfaces:**
- Consumes: `updateMessageInPages`, `removeMessageFromPages`.
- Produces: cache response to `message:updated`, `message:deleted`, `message:hidden`.

- [ ] **Step 1: Write failing socket cache tests**

Add tests:

```ts
it('updates existing messages from socket edits', () => {
  const next = updateMessageInPages(old, { id: 'msg-1', chatId: 'chat-1', text: 'edited' });
  expect(next?.pages[0].messages[0].text).toBe('edited');
});

it('removes deleted and hidden messages from pages', () => {
  const next = removeMessageFromPages(old, 'msg-1');
  expect(next?.pages[0].messages.some((message) => message.id === 'msg-1')).toBe(false);
});
```

- [ ] **Step 2: Run red socket tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/socket/chat-cache-updaters.spec.ts
```

Expected: FAIL until socket updater exports/imports are wired.

- [ ] **Step 3: Wire socket events**

In `chat-socket-manager.ts`, subscribe:

```ts
socket.on('message:updated', handleMessageUpdated);
socket.on('message:deleted', handleMessageRemoved);
socket.on('message:hidden', handleMessageRemoved);
```

Handlers update `['messages', chatId]` with `updateMessageInPages` or `removeMessageFromPages`.

- [ ] **Step 4: Run green socket tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/socket/chat-cache-updaters.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/messenger/src/app/socket/chat-cache-updaters.ts apps/client/messenger/src/app/socket/chat-socket-manager.ts apps/client/messenger/src/app/socket/chat-cache-updaters.spec.ts
git commit -m "feat(client): handle message action sockets"
```

---

### Task 7: Message Actions UI

**Files:**
- Modify: `libs/client/entities/message/src/ui/message-bubble.tsx`
- Create: `libs/client/entities/message/src/ui/message-actions-menu.tsx`
- Create: `libs/client/entities/message/src/ui/message-actions-menu.spec.tsx`
- Modify: `libs/client/entities/message/src/index.ts`
- Modify: `apps/client/messenger/src/test-stubs/shared.tsx`
- Test: `apps/client/messenger/src/app/message-actions-ui.spec.tsx`

**Interfaces:**
- Produces: `<MessageActionsMenu message isMine onEdit onForward onDelete />`.
- Produces: `MessageBubble` `actionsSlot?: ReactNode` prop and edited marker.

- [ ] **Step 1: Write failing menu tests**

Create `message-actions-menu.spec.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageActionsMenu } from './message-actions-menu';

const baseMessage = {
  id: 'msg-1',
  chatId: 'chat-1',
  senderId: 'user-1',
  type: 'TEXT',
  kind: 'text',
  text: 'hello',
  fileId: null,
};

it('shows edit only for own text messages without files', () => {
  render(<MessageActionsMenu message={baseMessage} isMine onEdit={jest.fn()} onForward={jest.fn()} onDelete={jest.fn()} />);
  fireEvent.click(screen.getByLabelText('Message actions'));
  expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeTruthy();
});

it('hides edit for file messages and keeps forward copy delete', () => {
  render(<MessageActionsMenu message={{ ...baseMessage, fileId: 'file-1' }} isMine onEdit={jest.fn()} onForward={jest.fn()} onDelete={jest.fn()} />);
  fireEvent.click(screen.getByLabelText('Message actions'));
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
  expect(screen.getByRole('menuitem', { name: 'Forward' })).toBeTruthy();
  expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeTruthy();
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
});
```

- [ ] **Step 2: Run red menu tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/message-actions-ui.spec.tsx
```

Expected: FAIL until menu component is implemented and reachable through app test stubs.

- [ ] **Step 3: Implement menu and bubble action slot**

Use existing `Dropdown` and `IconButton`:

```tsx
<IconButton aria-label="Message actions" size="sm" variant="ghost">...</IconButton>
```

Menu logic:

```ts
const canEdit = isMine && message.type === 'TEXT' && !message.fileId;
const canCopy = Boolean(message.text);
```

Render `Edit`, `Forward`, `Copy`, `Delete`. `Copy` calls `navigator.clipboard.writeText(message.text)` and never logs the text.

Add `actionsSlot?: ReactNode` to `MessageBubble` and render it near the timestamp. Add edited marker when `message.editedAt` is present:

```tsx
{message.editedAt ? <span>edited</span> : null}
```

- [ ] **Step 4: Run green menu tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/message-actions-ui.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/client/entities/message/src/ui/message-bubble.tsx libs/client/entities/message/src/ui/message-actions-menu.tsx libs/client/entities/message/src/ui/message-actions-menu.spec.tsx libs/client/entities/message/src/index.ts apps/client/messenger/src/test-stubs/shared.tsx apps/client/messenger/src/app/message-actions-ui.spec.tsx
git commit -m "feat(client): add message action menu"
```

---

### Task 8: Edit Mode And Delete Modal

**Files:**
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx`
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/chat-window.tsx`
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`
- Create: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/delete-message-modal.tsx`
- Test: `apps/client/messenger/src/app/message-actions-ui.spec.tsx`

**Interfaces:**
- Consumes: `useEditMessageMutation`, `useDeleteMessageMutation`, `MessageActionsMenu`.
- Produces: composer edit mode and delete confirmation with default checked `Delete for everyone`.

- [ ] **Step 1: Add failing UI integration tests**

Add tests:

```tsx
it('loads own text message into edit mode and saves through edit mutation', async () => {
  render(<ChatWindow chatId="chat-1" />);
  await user.click(screen.getAllByLabelText('Message actions')[0]);
  await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
  expect(screen.getByRole('textbox')).toHaveValue('hello');
  await user.clear(screen.getByRole('textbox'));
  await user.type(screen.getByRole('textbox'), 'edited');
  await user.click(screen.getByLabelText('Save edit'));
  expect(mockedAuthedFetch).toHaveBeenCalledWith('chats/chat-1/messages/msg-1', expect.objectContaining({ method: 'PATCH' }));
});

it('defaults own message delete confirmation to delete for everyone', async () => {
  render(<ChatWindow chatId="chat-1" />);
  await user.click(screen.getAllByLabelText('Message actions')[0]);
  await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(screen.getByRole('checkbox', { name: 'Delete for everyone' })).toBeChecked();
});
```

Use the existing app test mocking patterns for messages and `authedFetch`.

- [ ] **Step 2: Run red UI tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/message-actions-ui.spec.tsx
```

Expected: FAIL because edit mode and delete modal are not wired.

- [ ] **Step 3: Implement edit mode**

Add state in `chat-window.tsx`:

```ts
const [editingMessage, setEditingMessage] = useState<Message | null>(null);
```

Pass `onEditMessage={setEditingMessage}` to message list and `editingMessage` to footer.

In `ChatFooter`, when editing:

- initial textarea value is `editingMessage.text ?? ''`;
- submit calls `editMessageMutation.mutate({ messageId: editingMessage.id, text })`;
- send button aria-label is `Save edit`;
- cancel button clears edit mode.

- [ ] **Step 4: Implement delete modal**

`DeleteMessageModal` props:

```ts
interface DeleteMessageModalProps {
  message: Message | null;
  isMine: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'ME' | 'EVERYONE') => void;
}
```

Default checkbox state:

```ts
const [deleteForEveryone, setDeleteForEveryone] = useState(isMine);
```

Confirm mode:

```ts
onConfirm(isMine && deleteForEveryone ? 'EVERYONE' : 'ME');
```

- [ ] **Step 5: Run green UI tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/message-actions-ui.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/chat-window.tsx libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/delete-message-modal.tsx apps/client/messenger/src/app/message-actions-ui.spec.tsx
git commit -m "feat(client): edit and delete messages"
```

---

### Task 9: Forward Modal

**Files:**
- Create: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/forward-message-modal.tsx`
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`
- Modify: `libs/client/pages/messenger/pages-chat-page/tsconfig.lib.json`
- Test: `apps/client/messenger/src/app/message-actions-ui.spec.tsx`

**Interfaces:**
- Consumes: `useGetChatsSuspenseQuery`, `useSearchUsers`, `useCreateDirectChatMutation`, `useCreateSelfChatMutation`, `useForwardMessagesMutation`.
- Produces: Telegram-like `Forward to...` modal with `Saved Messages` first.

- [ ] **Step 1: Add failing forward modal tests**

Add tests:

```tsx
it('opens a Forward to modal with Saved Messages first', async () => {
  render(<ChatWindow chatId="chat-1" />);
  await user.click(screen.getAllByLabelText('Message actions')[0]);
  await user.click(screen.getByRole('menuitem', { name: 'Forward' }));

  expect(screen.getByRole('heading', { name: 'Forward to...' })).toBeTruthy();
  expect(screen.getAllByTestId('forward-target-row')[0]).toHaveTextContent('Saved Messages');
});

it('forwards to saved messages by creating self chat first', async () => {
  render(<ChatWindow chatId="chat-1" />);
  await user.click(screen.getAllByLabelText('Message actions')[0]);
  await user.click(screen.getByRole('menuitem', { name: 'Forward' }));
  await user.click(screen.getByText('Saved Messages'));

  expect(mockedAuthedFetch).toHaveBeenCalledWith('chats/self', expect.objectContaining({ method: 'POST' }));
  expect(mockedAuthedFetch).toHaveBeenCalledWith('chats/self-chat-id/forward', expect.objectContaining({ method: 'POST' }));
});
```

- [ ] **Step 2: Run red forward tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/message-actions-ui.spec.tsx
```

Expected: FAIL because forward modal is missing.

- [ ] **Step 3: Implement forward modal**

Modal layout:

```tsx
<Modal isOpen={isOpen} onClose={onClose} className="max-w-sm">
  <Modal.Header title="Forward to..." />
  <Modal.Body className="p-0">
    <div className="border-b border-border p-3">
      <Input aria-label="Search forward targets" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
    </div>
    <div className="max-h-[70vh] overflow-y-auto">
      <button data-testid="forward-target-row">Saved Messages</button>
      {targets.map((target) => <button key={target.id} data-testid="forward-target-row">{target.title}</button>)}
    </div>
  </Modal.Body>
</Modal>
```

Target behavior:

- Saved Messages: call create self chat, then forward.
- Existing chat: forward directly.
- User result: create direct chat, then forward.

Forward body:

```ts
{ sourceChatId, messageIds: [message.id] }
```

- [ ] **Step 4: Run green forward tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand --runTestsByPath src/app/message-actions-ui.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/forward-message-modal.tsx libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx libs/client/pages/messenger/pages-chat-page/tsconfig.lib.json apps/client/messenger/src/app/message-actions-ui.spec.tsx
git commit -m "feat(client): forward messages from modal"
```

---

### Task 10: Full Verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified working feature.

- [ ] **Step 1: Run backend tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/common -- --runInBand
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat -- --runInBand
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway -- --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run client tests**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger -- --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run typecheck and lint**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/common
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/chat
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/gateway
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/entities-message
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/pages-chat-page
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/messenger
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/common
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/chat
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/gateway
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/entities-message
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/pages-chat-page
env NX_ISOLATE_PLUGINS=false npm exec nx -- lint @org/messenger
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
git log --oneline -10
```

Expected: worktree clean after final commit; recent commits show one commit per completed task.
