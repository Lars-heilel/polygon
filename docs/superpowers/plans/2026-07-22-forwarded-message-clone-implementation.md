# Forwarded Message Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Telegram-style forwarded messages as independent message clones with separate forward context, message attachments, media references, and context-scoped media access.

**Architecture:** `Message` becomes current-chat state only. `MessageForwardContext` stores immutable original-author provenance. `MessageAttachment` gives every message its own attachment rows while `MediaReference` protects shared physical media objects from deletion.

**Tech Stack:** Nx monorepo, NestJS, RabbitMQ `ClientProxy`, Prisma 7, PostgreSQL, React 19, TanStack Query, Socket.IO, Zod schemas in `@org/common`.

## Global Constraints

- Follow `docs/ARCHITECTURE.md`: Gateway is the only client entry point; database-per-service boundaries stay intact.
- Follow `docs/DEVELOPMENT.md`: every new or changed endpoint/RPC/socket flow must include lifecycle logs for requested, denied/failed, skipped, and success paths without raw ids, message text, file names, object keys, or presigned URLs.
- Do not implement runtime display joins from forwarded target messages back to the source chat or source message.
- Do not physically copy object storage bytes during forwarding.
- Chat media rendering must migrate away from `/api/media/files/:fileId/content` to chat/message/attachment scoped URLs.
- Old test-mode forwarded data does not need a repair job.
- Use `npm exec nx` for build, test, typecheck, and Prisma targets.
- Use TDD for each behavior change: write the failing test, run it red, implement, run green, then commit.

---

## File Structure

Create or modify these files during implementation:

- `libs/common/src/schemas/chat/message.schema.ts`: nested `messageAttachmentSchema`, `messageForwardContextSchema`, and updated `messageSchema`.
- `libs/common/src/schemas/chat/chat-select.ts`: selects for nested chat message relations.
- `libs/common/src/schemas/chat/forward-message.schema.ts`: extend forward DTO contracts for prepare/clone payloads.
- `libs/backend/chat/src/database/prisma/schema.prisma`: add `MessageAttachment` and `MessageForwardContext`; later remove legacy `Message.file*` and `Message.forwardedFrom*`.
- `libs/backend/chat/src/database/prisma/migrations/*/migration.sql`: migrations for new tables and cleanup.
- `libs/backend/chat/src/interfaces/chat.interface.ts`: repository/service contracts for source preparation, clone creation, attachments, and forward context.
- `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`: nested selects, transaction clone creation, attachment operations.
- `libs/backend/chat/src/services/chat.service.ts`: prepare-forward and clone-forward business flow with lifecycle logs.
- `libs/backend/chat/src/controllers/chat.controller.ts`: RPC handlers for prepare and clone forward commands.
- `libs/backend/media/src/database/prisma/schema.prisma`: add `MediaReference`.
- `libs/backend/media/src/interfaces/media.interface.ts`: reference create/delete/count contracts.
- `libs/backend/media/src/database/repository/media.prisma.repo.ts`: media reference persistence.
- `libs/backend/media/src/services/media.service.ts`: reference lifecycle and safe physical delete.
- `libs/backend/media/src/controllers/media.controller.ts`: RPC handlers for media references.
- `apps/backend/gateway/src/controllers/chat.controller.ts`: orchestrate forward prepare, User Service author snapshot lookup, clone command, broadcasts.
- `apps/backend/gateway/src/controllers/media.controller.ts`: add context-scoped attachment content route.
- `libs/client/entities/message/src/message.types.ts`: nested `attachments` and `forwardContext`.
- `libs/client/entities/message/src/message-normalizer.ts`: normalize nested and legacy message payloads during migration.
- `libs/client/entities/message/src/ui/message-bubble.tsx`: Telegram-style forward header.
- `libs/client/entities/message/src/ui/file-message.tsx`: use attachment content URL instead of raw `fileId` URL.
- `libs/client/features/send-message/src/use-send-message.ts`: optimistic messages with `attachments`.
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`: audio queue and file render data from attachments.
- Existing tests under `apps/backend/gateway/src/controllers`, `libs/backend/chat/src/services`, `libs/backend/media/src/services`, and `apps/client/messenger/src/app`.

---

### Task 1: Shared Message Contract

**Files:**
- Modify: `libs/common/src/schemas/chat/message.schema.ts`
- Modify: `libs/common/src/schemas/chat/message-actions.schema.spec.ts`
- Modify: `libs/common/src/schemas/chat/chat-select.ts`

**Interfaces:**
- Produces:
  - `messageAttachmentSchema`
  - `messageForwardContextSchema`
  - `MessageAttachment`
  - `MessageForwardContext`
  - `Message.forwardContext: MessageForwardContext | null`
  - `Message.attachments: MessageAttachment[]`
- Consumes: existing `messageTypeSchema`.

- [ ] **Step 1: Write failing schema tests**

Add tests in `libs/common/src/schemas/chat/message-actions.schema.spec.ts`:

```ts
it('accepts nested forward context and attachments on messages', () => {
  const createdAt = new Date('2026-07-22T10:00:00.000Z');

  const parsed = messageSchema.parse({
    id: '11111111-1111-4111-8111-111111111111',
    clientId: null,
    chatId: '22222222-2222-4222-8222-222222222222',
    senderId: '33333333-3333-4333-8333-333333333333',
    type: 'AUDIO',
    text: null,
    attachments: [{
      id: '44444444-4444-4444-8444-444444444444',
      messageId: '11111111-1111-4111-8111-111111111111',
      mediaId: '55555555-5555-4555-8555-555555555555',
      fileNameSnapshot: 'voice.ogg',
      fileSizeSnapshot: 33000,
      mimeSnapshot: 'audio/ogg',
      category: 'VOICE',
      createdAt,
    }],
    forwardContext: {
      messageId: '11111111-1111-4111-8111-111111111111',
      originalMessageId: '66666666-6666-4666-8666-666666666666',
      originalChatId: '77777777-7777-4777-8777-777777777777',
      originalAuthorId: '88888888-8888-4888-8888-888888888888',
      originalAuthorNameSnapshot: 'tamilka',
      originalAuthorDisplayNameSnapshot: 'Тамилка:3',
      originalMessageCreatedAt: createdAt,
      originalMessageType: 'AUDIO',
      originalTextPreview: null,
      originalFileNamePreview: 'voice.ogg',
      snapshotVersion: 1,
      createdAt,
    },
    fileId: null,
    fileBucket: null,
    fileKey: null,
    fileName: null,
    fileSize: null,
    fileMime: null,
    fileCategory: null,
    forwardedFromId: null,
    forwardedFromSenderId: null,
    forwardedFromCreatedAt: null,
    forwardedFromType: null,
    forwardedFromText: null,
    forwardedFromFileName: null,
    editedAt: null,
    deletedAt: null,
    deletedById: null,
    createdAt,
    updatedAt: createdAt,
  });

  expect(parsed.forwardContext?.originalAuthorDisplayNameSnapshot).toBe('Тамилка:3');
  expect(parsed.attachments[0].category).toBe('VOICE');
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/common --runTestsByPath src/schemas/chat/message-actions.schema.spec.ts --runInBand --skip-nx-cache
```

Expected: FAIL because `attachments` and `forwardContext` are stripped or rejected.

- [ ] **Step 3: Implement common schemas**

In `libs/common/src/schemas/chat/message.schema.ts`, add:

```ts
export const messageAttachmentSchema = z.object({
  id: z.uuid(),
  messageId: z.uuid(),
  mediaId: z.uuid(),
  fileNameSnapshot: z.string().nullable(),
  fileSizeSnapshot: z.number().int().positive().nullable(),
  mimeSnapshot: z.string().nullable(),
  category: z.string(),
  createdAt: z.date(),
});

export const messageForwardContextSchema = z.object({
  messageId: z.uuid(),
  originalMessageId: z.uuid().nullable(),
  originalChatId: z.uuid().nullable(),
  originalAuthorId: z.uuid(),
  originalAuthorNameSnapshot: z.string().min(1),
  originalAuthorDisplayNameSnapshot: z.string().nullable(),
  originalMessageCreatedAt: z.date(),
  originalMessageType: messageTypeSchema,
  originalTextPreview: z.string().nullable(),
  originalFileNamePreview: z.string().nullable(),
  snapshotVersion: z.number().int().positive(),
  createdAt: z.date(),
});
```

Extend `messageSchema` with:

```ts
attachments: z.array(messageAttachmentSchema).default([]),
forwardContext: messageForwardContextSchema.nullable().default(null),
```

Keep legacy `file*` and `forwardedFrom*` fields for transition.

- [ ] **Step 4: Update select constants**

In `libs/common/src/schemas/chat/chat-select.ts`, add nested selects:

```ts
export const MESSAGE_ATTACHMENT_SELECT_FIELDS = {
  id: true,
  messageId: true,
  mediaId: true,
  fileNameSnapshot: true,
  fileSizeSnapshot: true,
  mimeSnapshot: true,
  category: true,
  createdAt: true,
} as const;

export const MESSAGE_FORWARD_CONTEXT_SELECT_FIELDS = {
  messageId: true,
  originalMessageId: true,
  originalChatId: true,
  originalAuthorId: true,
  originalAuthorNameSnapshot: true,
  originalAuthorDisplayNameSnapshot: true,
  originalMessageCreatedAt: true,
  originalMessageType: true,
  originalTextPreview: true,
  originalFileNamePreview: true,
  snapshotVersion: true,
  createdAt: true,
} as const;
```

Do not add these relations to `MESSAGE_SELECT_FIELDS` in this task. The Prisma relations do not exist until Task 2, so Task 1 only exports the reusable nested select constants. Task 2 wires them into the main message select after the database schema is extended.

- [ ] **Step 5: Run GREEN**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/common --runTestsByPath src/schemas/chat/message-actions.schema.spec.ts --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- build @org/common --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/common/src/schemas/chat/message.schema.ts libs/common/src/schemas/chat/message-actions.schema.spec.ts libs/common/src/schemas/chat/chat-select.ts
git commit -m "feat(common): add message forward context contract"
```

---

### Task 2: Chat DB MessageForwardContext And MessageAttachment

**Files:**
- Modify: `libs/backend/chat/src/database/prisma/schema.prisma`
- Create: `libs/backend/chat/src/database/prisma/migrations/<timestamp>_add_message_forward_context_and_attachments/migration.sql`
- Modify: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`
- Modify: `libs/backend/chat/src/interfaces/chat.interface.ts`
- Modify: `libs/common/src/schemas/chat/chat-select.ts`
- Test: `libs/backend/chat/src/database/repository/chat.prisma.repo.spec.ts` or `libs/backend/chat/src/services/chat.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 `MESSAGE_ATTACHMENT_SELECT_FIELDS` and `MESSAGE_FORWARD_CONTEXT_SELECT_FIELDS`.
- Produces:
  - Prisma `MessageAttachment`
  - Prisma `MessageForwardContext`
  - repository method `createMessageWithRelations(data: CreateMessageWithRelationsData): Promise<Message>`

Wire the new relations into `MESSAGE_SELECT_FIELDS` only after Prisma `MessageAttachment` and `MessageForwardContext` are added:

```ts
attachments: { select: MESSAGE_ATTACHMENT_SELECT_FIELDS },
forwardContext: { select: MESSAGE_FORWARD_CONTEXT_SELECT_FIELDS },
```

- [ ] **Step 1: Write failing repository/service test**

Add a test that expects a created message to include nested attachment and forward context:

```ts
it('creates a message with attachments and forward context in one repository call', async () => {
  const repo = repoMock();
  const service = new ChatService(repo);
  repo.findChatMember.mockResolvedValue({ chatId: 'target-chat', userId: 'user-1', role: 'MEMBER', joinedAt: new Date(), lastReadMessageId: null, lastReadAt: null });
  repo.createMessageWithRelations.mockResolvedValue({
    id: 'message-1',
    chatId: 'target-chat',
    senderId: 'user-1',
    type: 'VOICE',
    text: null,
    attachments: [{ id: 'attachment-1', messageId: 'message-1', mediaId: 'media-1', fileNameSnapshot: 'voice.ogg', fileSizeSnapshot: 33000, mimeSnapshot: 'audio/ogg', category: 'VOICE', createdAt: new Date() }],
    forwardContext: { messageId: 'message-1', originalAuthorId: 'author-1', originalAuthorNameSnapshot: 'tamilka', originalAuthorDisplayNameSnapshot: 'Тамилка:3', originalMessageId: 'source-1', originalChatId: 'source-chat', originalMessageCreatedAt: new Date(), originalMessageType: 'VOICE', originalTextPreview: null, originalFileNamePreview: 'voice.ogg', snapshotVersion: 1, createdAt: new Date() },
    clientId: null,
    fileId: null,
    fileBucket: null,
    fileKey: null,
    fileName: null,
    fileSize: null,
    fileMime: null,
    fileCategory: null,
    forwardedFromId: null,
    forwardedFromSenderId: null,
    forwardedFromCreatedAt: null,
    forwardedFromType: null,
    forwardedFromText: null,
    forwardedFromFileName: null,
    editedAt: null,
    deletedAt: null,
    deletedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await service.sendMessage('target-chat', 'user-1', {
    type: 'VOICE',
    text: null,
    attachments: [{ mediaId: 'media-1', fileNameSnapshot: 'voice.ogg', fileSizeSnapshot: 33000, mimeSnapshot: 'audio/ogg', category: 'VOICE' }],
  });

  expect(repo.createMessageWithRelations).toHaveBeenCalledWith(expect.objectContaining({
    attachments: [expect.objectContaining({ mediaId: 'media-1', category: 'VOICE' })],
  }));
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat --runTestsByPath src/services/chat.service.spec.ts --runInBand --skip-nx-cache
```

Expected: FAIL because the repository method and attachment input type do not exist.

- [ ] **Step 3: Add Prisma models**

In `libs/backend/chat/src/database/prisma/schema.prisma` add:

```prisma
model MessageAttachment {
  id               String   @id @default(uuid())
  messageId        String   @map("message_id")
  mediaId          String   @map("media_id")
  fileNameSnapshot String?  @map("file_name_snapshot")
  fileSizeSnapshot Int?     @map("file_size_snapshot")
  mimeSnapshot     String?  @map("mime_snapshot")
  category         String   @map("category")
  createdAt        DateTime @default(now()) @map("created_at")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@index([mediaId])
  @@map("message_attachments")
}

model MessageForwardContext {
  messageId                         String      @id @map("message_id")
  originalMessageId                 String?     @map("original_message_id")
  originalChatId                    String?     @map("original_chat_id")
  originalAuthorId                  String      @map("original_author_id")
  originalAuthorNameSnapshot        String      @map("original_author_name_snapshot")
  originalAuthorDisplayNameSnapshot String?     @map("original_author_display_name_snapshot")
  originalMessageCreatedAt          DateTime    @map("original_message_created_at")
  originalMessageType               MessageType @map("original_message_type")
  originalTextPreview               String?     @map("original_text_preview")
  originalFileNamePreview           String?     @map("original_file_name_preview")
  snapshotVersion                   Int         @default(1) @map("snapshot_version")
  createdAt                         DateTime    @default(now()) @map("created_at")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([originalAuthorId])
  @@index([originalChatId])
  @@map("message_forward_contexts")
}
```

Add to `Message`:

```prisma
attachments    MessageAttachment[]
forwardContext MessageForwardContext?
```

- [ ] **Step 4: Add migration**

Create migration SQL:

```sql
CREATE TABLE "message_attachments" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "file_name_snapshot" TEXT,
  "file_size_snapshot" INTEGER,
  "mime_snapshot" TEXT,
  "category" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_forward_contexts" (
  "message_id" TEXT NOT NULL,
  "original_message_id" TEXT,
  "original_chat_id" TEXT,
  "original_author_id" TEXT NOT NULL,
  "original_author_name_snapshot" TEXT NOT NULL,
  "original_author_display_name_snapshot" TEXT,
  "original_message_created_at" TIMESTAMP(3) NOT NULL,
  "original_message_type" "MessageType" NOT NULL,
  "original_text_preview" TEXT,
  "original_file_name_preview" TEXT,
  "snapshot_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_forward_contexts_pkey" PRIMARY KEY ("message_id")
);

ALTER TABLE "message_attachments"
  ADD CONSTRAINT "message_attachments_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_forward_contexts"
  ADD CONSTRAINT "message_forward_contexts_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");
CREATE INDEX "message_attachments_media_id_idx" ON "message_attachments"("media_id");
CREATE INDEX "message_forward_contexts_original_author_id_idx" ON "message_forward_contexts"("original_author_id");
CREATE INDEX "message_forward_contexts_original_chat_id_idx" ON "message_forward_contexts"("original_chat_id");
```

- [ ] **Step 5: Generate Prisma client**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/chat:prisma-generate
```

Expected: Prisma client generation succeeds.

- [ ] **Step 6: Add repository interface and implementation**

In `libs/backend/chat/src/interfaces/chat.interface.ts`, add:

```ts
export interface CreateMessageAttachmentData {
  mediaId: string;
  fileNameSnapshot?: string | null;
  fileSizeSnapshot?: number | null;
  mimeSnapshot?: string | null;
  category: string;
}

export interface CreateMessageForwardContextData {
  originalMessageId?: string | null;
  originalChatId?: string | null;
  originalAuthorId: string;
  originalAuthorNameSnapshot: string;
  originalAuthorDisplayNameSnapshot?: string | null;
  originalMessageCreatedAt: Date;
  originalMessageType: MessageType;
  originalTextPreview?: string | null;
  originalFileNamePreview?: string | null;
}

export type CreateMessageWithRelationsData = CreateMessageData & {
  attachments?: CreateMessageAttachmentData[];
  forwardContext?: CreateMessageForwardContextData | null;
};
```

Add repository method:

```ts
createMessageWithRelations(data: CreateMessageWithRelationsData): Promise<Message>;
```

In Prisma repository, create the message with nested `attachments.create` and `forwardContext.create`, selecting `MESSAGE_SELECT_FIELDS`.

- [ ] **Step 7: Run GREEN**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat --runTestsByPath src/services/chat.service.spec.ts --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/chat --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/backend/chat/src/database/prisma/schema.prisma libs/backend/chat/src/database/prisma/migrations libs/backend/chat/src/interfaces/chat.interface.ts libs/backend/chat/src/database/repository/chat.prisma.repo.ts libs/backend/chat/src/services/chat.service.spec.ts
git commit -m "feat(chat): add message attachments and forward context"
```

---

### Task 3: Media References And Safe Delete

**Files:**
- Modify: `libs/backend/media/src/database/prisma/schema.prisma`
- Create: `libs/backend/media/src/database/prisma/migrations/<timestamp>_add_media_references/migration.sql`
- Modify: `libs/backend/media/src/interfaces/media.interface.ts`
- Modify: `libs/backend/media/src/database/repository/media.prisma.repo.ts`
- Modify: `libs/backend/media/src/services/media.service.ts`
- Modify: `libs/backend/media/src/controllers/media.controller.ts`
- Modify: `libs/backend/core/src/constants/queues/media.queue.ts`
- Test: `libs/backend/media/src/services/media.service.spec.ts`

**Interfaces:**
- Produces RPCs:
  - `media.references.create`
  - `media.references.delete`
  - `media.references.count`
- Produces service methods:
  - `createReference(input: CreateMediaReferenceInput): Promise<MediaReferenceResponse>`
  - `deleteReference(input: DeleteMediaReferenceInput): Promise<{ deleted: boolean; remainingCount: number }>`

- [ ] **Step 1: Write failing tests for reference-protected delete**

In `libs/backend/media/src/services/media.service.spec.ts`:

```ts
it('does not delete the physical object while media references remain', async () => {
  const repo = repoMock();
  const storage = storageMock();
  repo.findById.mockResolvedValue({ id: 'file-1', bucket: 'media', key: 'voice.ogg', originalName: 'voice.ogg', mimeType: 'audio/ogg', size: 33000, url: null, uploaderId: 'user-1', status: 'READY', chatId: 'chat-1', category: 'VOICE', createdAt: new Date(), updatedAt: new Date() });
  repo.countReferences.mockResolvedValue(1);
  const service = new MediaService(repo, storage);

  await expect(service.delete('file-1')).resolves.toEqual({ success: false, reason: 'REFERENCED' });

  expect(storage.delete).not.toHaveBeenCalled();
  expect(repo.delete).not.toHaveBeenCalled();
});

it('deletes the physical object when no media references remain', async () => {
  const repo = repoMock();
  const storage = storageMock();
  repo.findById.mockResolvedValue({ id: 'file-1', bucket: 'media', key: 'voice.ogg', originalName: 'voice.ogg', mimeType: 'audio/ogg', size: 33000, url: null, uploaderId: 'user-1', status: 'READY', chatId: 'chat-1', category: 'VOICE', createdAt: new Date(), updatedAt: new Date() });
  repo.countReferences.mockResolvedValue(0);
  const service = new MediaService(repo, storage);

  await expect(service.delete('file-1')).resolves.toEqual({ success: true });

  expect(storage.delete).toHaveBeenCalledWith('media', 'voice.ogg');
  expect(repo.delete).toHaveBeenCalledWith('file-1');
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/media --runTestsByPath src/services/media.service.spec.ts --runInBand --skip-nx-cache
```

Expected: FAIL because reference methods do not exist.

- [ ] **Step 3: Add Prisma model and migration**

In media Prisma schema:

```prisma
enum MediaReferenceOwnerType {
  MESSAGE_ATTACHMENT
}

model MediaReference {
  id        String                  @id @default(uuid())
  fileId    String                  @map("file_id")
  ownerType MediaReferenceOwnerType @map("owner_type")
  ownerId   String                  @map("owner_id")
  createdAt DateTime                @default(now()) @map("created_at")

  file File @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@unique([ownerType, ownerId])
  @@index([fileId])
  @@map("media_references")
}
```

Add to `File`:

```prisma
references MediaReference[]
```

Migration SQL:

```sql
CREATE TYPE "MediaReferenceOwnerType" AS ENUM ('MESSAGE_ATTACHMENT');

CREATE TABLE "media_references" (
  "id" TEXT NOT NULL,
  "file_id" TEXT NOT NULL,
  "owner_type" "MediaReferenceOwnerType" NOT NULL,
  "owner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_references_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "media_references"
  ADD CONSTRAINT "media_references_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "media_references_owner_type_owner_id_key" ON "media_references"("owner_type", "owner_id");
CREATE INDEX "media_references_file_id_idx" ON "media_references"("file_id");
```

- [ ] **Step 4: Implement repository and service methods**

In media interfaces:

```ts
export type MediaReferenceOwnerType = 'MESSAGE_ATTACHMENT';

export interface CreateMediaReferenceInput {
  fileId: string;
  ownerType: MediaReferenceOwnerType;
  ownerId: string;
}

export interface DeleteMediaReferenceInput {
  ownerType: MediaReferenceOwnerType;
  ownerId: string;
}

export interface MediaReferenceResponse {
  id: string;
  fileId: string;
  ownerType: MediaReferenceOwnerType;
  ownerId: string;
  createdAt: Date;
}
```

Add repository methods:

```ts
createReference(input: CreateMediaReferenceInput): Promise<MediaReferenceResponse>;
deleteReference(input: DeleteMediaReferenceInput): Promise<void>;
countReferences(fileId: string): Promise<number>;
```

Add service logs:

```ts
this.logger.log({ eventType: 'media_reference_created', hasFileId: !!input.fileId, ownerType: input.ownerType });
this.logger.log({ eventType: 'media_reference_delete_skipped', hasFileId: !!file.id, referenceCount });
this.logger.log({ eventType: 'media_file_gc_deleted', hasFileId: !!file.id });
```

- [ ] **Step 5: Add RPC handlers**

In media controller:

```ts
@MessagePattern(MEDIA_PATTERNS.CREATE_REFERENCE)
createReference(@Payload() payload: CreateMediaReferenceInput): Promise<MediaReferenceResponse> {
  return this.mediaService.createReference(payload);
}

@MessagePattern(MEDIA_PATTERNS.DELETE_REFERENCE)
deleteReference(@Payload() payload: DeleteMediaReferenceInput): Promise<{ deleted: boolean; remainingCount: number }> {
  return this.mediaService.deleteReference(payload);
}
```

Add constants in `libs/backend/core/src/constants/queues/media.queue.ts`:

```ts
CREATE_REFERENCE: 'media.references.create',
DELETE_REFERENCE: 'media.references.delete',
```

- [ ] **Step 6: Run GREEN**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/media:prisma-generate
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/media --runTestsByPath src/services/media.service.spec.ts --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/media --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/backend/media/src/database/prisma/schema.prisma libs/backend/media/src/database/prisma/migrations libs/backend/media/src/interfaces/media.interface.ts libs/backend/media/src/database/repository/media.prisma.repo.ts libs/backend/media/src/services/media.service.ts libs/backend/media/src/controllers/media.controller.ts libs/backend/core/src/constants/queues/media.queue.ts libs/backend/media/src/services/media.service.spec.ts
git commit -m "feat(media): add media references"
```

---

### Task 4: Context-Scoped Attachment Content Route

**Files:**
- Modify: `apps/backend/gateway/src/controllers/media.controller.ts`
- Modify: `apps/backend/gateway/src/controllers/media.controller.spec.ts`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/backend/chat/src/interfaces/chat.interface.ts`
- Modify: `libs/backend/core/src/constants/queues/chat.queue.ts`

**Interfaces:**
- Produces:
  - `CHAT_PATTERNS.GET_MESSAGE_ATTACHMENT_FOR_ACCESS`
  - Gateway route `GET /api/chats/:chatId/messages/:messageId/attachments/:attachmentId/content`
  - Chat RPC response `{ mediaId: string; bucket?: never; key?: never }` or `{ mediaId: string }`

- [ ] **Step 1: Write failing gateway authorization tests**

In `apps/backend/gateway/src/controllers/media.controller.spec.ts`, add:

```ts
it('serves chat attachment content only after chat-scoped access succeeds', async () => {
  const ctx = controller();
  ctx.chatClient.send.mockReturnValueOnce(of({
    mediaId: '55555555-5555-4555-8555-555555555555',
  }));
  ctx.mediaClient.send.mockReturnValueOnce(of({
    id: '55555555-5555-4555-8555-555555555555',
    bucket: 'chat-media',
    key: 'voice.ogg',
    mimeType: 'audio/ogg',
    size: 33000,
    chatId: '22222222-2222-4222-8222-222222222222',
  }));

  await ctx.controller.getChatAttachmentContent(
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    { sub: '33333333-3333-4333-8333-333333333333' } as never,
    reqMock(),
    resMock(),
  );

  expect(ctx.chatClient.send).toHaveBeenCalledWith(
    CHAT_PATTERNS.GET_MESSAGE_ATTACHMENT_FOR_ACCESS,
    {
      chatId: '22222222-2222-4222-8222-222222222222',
      messageId: '11111111-1111-4111-8111-111111111111',
      attachmentId: '44444444-4444-4444-8444-444444444444',
      userId: '33333333-3333-4333-8333-333333333333',
    },
  );
});
```

The logger assertions in this test must check redaction separately and must not expect log payloads to include raw ids.

- [ ] **Step 2: Run RED**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway --runTestsByPath src/controllers/media.controller.spec.ts --runInBand --skip-nx-cache
```

Expected: FAIL because route and chat RPC do not exist.

- [ ] **Step 3: Add Chat access RPC**

Add constant:

```ts
GET_MESSAGE_ATTACHMENT_FOR_ACCESS: 'chat.messageAttachment.getForAccess',
```

Add service method:

```ts
async getMessageAttachmentForAccess(input: {
  chatId: string;
  messageId: string;
  attachmentId: string;
  userId: string;
}): Promise<{ mediaId: string }> {
  this.logger.debug({
    eventType: 'message_attachment_access_requested',
    hasChatId: !!input.chatId,
    hasMessageId: !!input.messageId,
    hasAttachmentId: !!input.attachmentId,
    hasUserId: !!input.userId,
  });
  // membership, message belongs to chat, attachment belongs to message
}
```

Repository method:

```ts
findMessageAttachmentForAccess(input: {
  chatId: string;
  messageId: string;
  attachmentId: string;
  userId: string;
}): Promise<{ mediaId: string } | null>;
```

- [ ] **Step 4: Add Gateway route**

In media gateway controller:

```ts
@Get('chats/:chatId/messages/:messageId/attachments/:attachmentId/content')
async getChatAttachmentContent(
  @Param('chatId') chatId: string,
  @Param('messageId') messageId: string,
  @Param('attachmentId') attachmentId: string,
  @CurrentUser() user: JwtPayload,
  @Req() req: Request,
  @Res() res: Response,
) {
  this.logger.debug({
    eventType: 'message_attachment_content_requested',
    hasChatId: !!chatId,
    hasMessageId: !!messageId,
    hasAttachmentId: !!attachmentId,
    hasUserId: !!user.sub,
  });
  const attachment = await this.send<{ mediaId: string }>(
    this.chatClient.send(CHAT_PATTERNS.GET_MESSAGE_ATTACHMENT_FOR_ACCESS, {
      chatId,
      messageId,
      attachmentId,
      userId: user.sub,
    }),
  );
  return this.streamMediaFile(attachment.mediaId, req, res);
}
```

Extract the existing file streaming body into:

```ts
private async streamMediaFile(fileId: string, req: Request, res: Response): Promise<void>
```

The extracted method may still use `MEDIA_PATTERNS.GET_BY_ID`, but caller authorization must come from the chat attachment route.

- [ ] **Step 5: Run GREEN**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway --runTestsByPath src/controllers/media.controller.spec.ts --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- build @org/gateway --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/gateway/src/controllers/media.controller.ts apps/backend/gateway/src/controllers/media.controller.spec.ts libs/backend/chat/src/controllers/chat.controller.ts libs/backend/chat/src/services/chat.service.ts libs/backend/chat/src/interfaces/chat.interface.ts libs/backend/core/src/constants/queues/chat.queue.ts
git commit -m "feat(chat): serve media through message attachments"
```

---

### Task 5: Send Message Writes Attachments And Media References

**Files:**
- Modify: `apps/backend/gateway/src/controllers/chat.controller.ts`
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Modify: `libs/backend/chat/src/interfaces/chat.interface.ts`
- Modify: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`
- Modify: `libs/client/features/send-message/src/use-send-message.ts`
- Modify: `libs/client/entities/message/src/message-normalizer.ts`

**Interfaces:**
- Consumes:
  - Task 2 `CreateMessageAttachmentData`
  - Task 3 `MEDIA_PATTERNS.CREATE_REFERENCE`
- Produces:
  - send message command can carry `attachments`
  - legacy `file*` input is converted into a single attachment during transition

- [ ] **Step 1: Write failing send tests**

Add backend test:

```ts
it('creates an attachment and media reference when sending a file message', async () => {
  const repo = repoMock();
  repo.findChatMember.mockResolvedValue(member);
  repo.createMessageWithRelations.mockResolvedValue(messageWithAttachment);
  const service = new ChatService(repo);

  await service.sendMessage('chat-1', 'user-1', {
    type: 'VOICE',
    fileId: '55555555-5555-4555-8555-555555555555',
    fileName: 'voice.ogg',
    fileSize: 33000,
    fileMime: 'audio/ogg',
    fileCategory: 'VOICE',
  });

  expect(repo.createMessageWithRelations).toHaveBeenCalledWith(expect.objectContaining({
    attachments: [expect.objectContaining({
      mediaId: '55555555-5555-4555-8555-555555555555',
      fileNameSnapshot: 'voice.ogg',
      category: 'VOICE',
    })],
  }));
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat --runTestsByPath src/services/chat.service.spec.ts --runInBand --skip-nx-cache
```

Expected: FAIL because send still writes inline file fields only.

- [ ] **Step 3: Implement legacy file-to-attachment conversion**

In Chat Service:

```ts
function buildAttachmentInput(input: SendMessageInput): CreateMessageAttachmentData[] {
  if (!input.fileId) return [];
  return [{
    mediaId: input.fileId,
    fileNameSnapshot: input.fileName ?? null,
    fileSizeSnapshot: input.fileSize ?? null,
    mimeSnapshot: input.fileMime ?? null,
    category: input.fileCategory ?? input.type ?? 'FILE',
  }];
}
```

Use `repo.createMessageWithRelations` for sends. Keep legacy inline file fields populated until cleanup so old client code keeps rendering during transition.

- [ ] **Step 4: Create media references**

After message creation, Chat Service creates references for each attachment through `MEDIA_CLIENT_TOKEN`. Add the media client to the Chat module provider setup. Reference creation happens after the Chat DB transaction returns created attachment ids. If any media reference creation fails, Chat Service logs `media_reference_create_failed`, removes the created message rows in a compensating cleanup, logs `message_send_compensated`, and throws so Gateway returns failure instead of exposing an unprotected attachment.

Expected event logs:

```ts
this.logger.log({ eventType: 'message_attachment_created', hasMessageId: true, attachmentCount });
this.logger.log({ eventType: 'media_reference_create_requested', attachmentCount });
```

- [ ] **Step 5: Run GREEN**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat --runTestsByPath src/services/chat.service.spec.ts --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway --runTestsByPath src/controllers/chat.controller.spec.ts src/gateways/chat.socket-gateway.spec.ts --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- typecheck @org/chat --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- build @org/gateway --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/gateway/src/controllers/chat.controller.ts apps/backend/gateway/src/gateways/chat.socket-gateway.ts libs/backend/chat/src/services/chat.service.ts libs/backend/chat/src/controllers/chat.controller.ts libs/backend/chat/src/interfaces/chat.interface.ts libs/backend/chat/src/database/repository/chat.prisma.repo.ts libs/client/features/send-message/src/use-send-message.ts libs/client/entities/message/src/message-normalizer.ts
git commit -m "feat(chat): write message attachments on send"
```

---

### Task 6: Forward Prepare And Clone Commands

**Files:**
- Modify: `libs/backend/core/src/constants/queues/chat.queue.ts`
- Modify: `libs/backend/chat/src/interfaces/chat.interface.ts`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`
- Modify: `apps/backend/gateway/src/controllers/chat.controller.ts`
- Modify: `apps/backend/gateway/src/controllers/chat.controller.spec.ts`

**Interfaces:**
- Produces:
  - `CHAT_PATTERNS.PREPARE_FORWARD_MESSAGES`
  - `CHAT_PATTERNS.CLONE_FORWARD_MESSAGES`
  - `PreparedForwardMessage`
  - `CloneForwardMessageInput`

- [ ] **Step 1: Write failing gateway orchestration test**

In gateway chat controller spec:

```ts
it('prepares source messages, snapshots original authors, and sends clone command', async () => {
  const ctx = controller();
  ctx.chatClient.send
    .mockReturnValueOnce(of([{
      messageId: '11111111-1111-4111-8111-111111111111',
      chatId: '22222222-2222-4222-8222-222222222222',
      senderId: '33333333-3333-4333-8333-333333333333',
      type: 'VOICE',
      text: null,
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
      attachments: [{ mediaId: '44444444-4444-4444-8444-444444444444', fileNameSnapshot: 'voice.ogg', fileSizeSnapshot: 33000, mimeSnapshot: 'audio/ogg', category: 'VOICE' }],
      forwardContext: null,
    }]))
    .mockReturnValueOnce(of([{ id: 'cloned-message', chatId: 'target-chat', senderId: 'forwarder', type: 'VOICE', text: null, attachments: [], forwardContext: null }]));
  ctx.userClient.send.mockReturnValue(of([{ id: '33333333-3333-4333-8333-333333333333', name: 'tamilka', displayName: 'Тамилка:3', avatarUrl: null, bio: null }]));

  await ctx.controller.forwardMessages({ sub: 'forwarder' } as never, 'target-chat', {
    sourceChatId: 'source-chat',
    messageIds: ['11111111-1111-4111-8111-111111111111'],
  });

  expect(ctx.chatClient.send).toHaveBeenNthCalledWith(1, CHAT_PATTERNS.PREPARE_FORWARD_MESSAGES, expect.any(Object));
  expect(ctx.userClient.send).toHaveBeenCalled();
  expect(ctx.chatClient.send).toHaveBeenNthCalledWith(2, CHAT_PATTERNS.CLONE_FORWARD_MESSAGES, expect.objectContaining({
    messages: [expect.objectContaining({
      originalAuthorNameSnapshot: 'tamilka',
      originalAuthorDisplayNameSnapshot: 'Тамилка:3',
    })],
  }));
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway --runTestsByPath src/controllers/chat.controller.spec.ts --runInBand --skip-nx-cache
```

Expected: FAIL because the two-step orchestration does not exist.

- [ ] **Step 3: Add Chat prepare command**

Add types:

```ts
export interface PreparedForwardMessage {
  messageId: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  text: string | null;
  createdAt: Date;
  attachments: CreateMessageAttachmentData[];
  forwardContext: CreateMessageForwardContextData | null;
}
```

`prepareForwardMessages` validates source and target membership, loads visible messages plus attachments/forward context, and returns prepared payloads. It logs:

```ts
message_forward_prepare_requested
message_forward_prepare_denied
message_forward_prepare_completed
message_forward_prepare_skipped
```

- [ ] **Step 4: Add Gateway author snapshot lookup**

In Gateway:

```ts
const originalAuthorIds = prepared.map((message) =>
  message.forwardContext?.originalAuthorId ?? message.senderId,
);
```

Call User Service once with unique ids. Build snapshot:

```ts
{
  originalAuthorId,
  originalAuthorNameSnapshot: profile?.name ?? 'Deleted user',
  originalAuthorDisplayNameSnapshot: profile?.displayName ?? null,
}
```

If any profile is missing, log `message_forward_author_snapshot_missing` with counts only.

- [ ] **Step 5: Add Chat clone command**

`cloneForwardMessages` creates each target message with:

```ts
{
  chatId: targetChatId,
  senderId: userId,
  type: prepared.type,
  text: prepared.text,
  attachments: prepared.attachments,
  forwardContext: prepared.forwardContext
    ? copy existing root context with author snapshot fields preserved
    : build context from prepared source message and gateway author snapshot,
}
```

Clone logs:

```ts
message_forward_clone_requested
message_forward_clone_created
message_attachment_clone_created
message_forward_clone_failed
```

- [ ] **Step 6: Run GREEN**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway --runTestsByPath src/controllers/chat.controller.spec.ts --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat --runTestsByPath src/services/chat.service.spec.ts --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- build @org/gateway --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/backend/core/src/constants/queues/chat.queue.ts libs/backend/chat/src/interfaces/chat.interface.ts libs/backend/chat/src/controllers/chat.controller.ts libs/backend/chat/src/services/chat.service.ts libs/backend/chat/src/database/repository/chat.prisma.repo.ts apps/backend/gateway/src/controllers/chat.controller.ts apps/backend/gateway/src/controllers/chat.controller.spec.ts
git commit -m "feat(chat): clone forwarded messages with author snapshots"
```

---

### Task 7: Client Nested Message Rendering And Attachment URLs

**Files:**
- Modify: `libs/client/entities/message/src/message.types.ts`
- Modify: `libs/client/entities/message/src/message-normalizer.ts`
- Modify: `libs/client/entities/message/src/ui/message-bubble.tsx`
- Modify: `libs/client/entities/message/src/ui/file-message.tsx`
- Modify: `libs/client/features/send-message/src/use-send-message.ts`
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`
- Modify tests: `apps/client/messenger/src/app/message-normalizer.spec.ts`, `apps/client/messenger/src/app/message-layout.spec.tsx`, file/audio rendering tests.

**Interfaces:**
- Consumes:
  - `RawMessage.attachments`
  - `RawMessage.forwardContext`
- Produces:
  - `Message.media.contentUrl = /api/chats/:chatId/messages/:messageId/attachments/:attachmentId/content`

- [ ] **Step 1: Write failing normalizer and layout tests**

In `message-normalizer.spec.ts`:

```ts
it('builds media content urls from chat message attachment context', () => {
  const message = normalizeMessage({
    ...baseRaw,
    type: 'VOICE',
    attachments: [{
      id: '44444444-4444-4444-8444-444444444444',
      messageId: baseRaw.id,
      mediaId: '55555555-5555-4555-8555-555555555555',
      fileNameSnapshot: 'voice.ogg',
      fileSizeSnapshot: 33000,
      mimeSnapshot: 'audio/ogg',
      category: 'VOICE',
      createdAt: '2026-07-22T10:00:00.000Z',
    }],
  });

  expect(message.media?.contentUrl).toBe(`/api/chats/${baseRaw.chatId}/messages/${baseRaw.id}/attachments/44444444-4444-4444-8444-444444444444/content`);
});
```

In `message-layout.spec.tsx`:

```ts
it('renders forwarded header from original author snapshot', () => {
  render(
    <MessageBubble
      message={{
        ...message,
        forwardContext: {
          originalAuthor: { id: 'author-1', nameSnapshot: 'tamilka', displayNameSnapshot: 'Тамилка:3' },
          originalMessageCreatedAt: '2026-07-22T10:00:00.000Z',
          originalMessageType: 'VOICE',
          preview: { text: null, fileName: 'voice.ogg' },
        },
      }}
      isMine={false}
      senderName="Forwarder"
    >
      <MessageContent text={null} isMine={false} />
    </MessageBubble>,
  );

  expect(screen.getByText('Тамилка:3')).toBeTruthy();
  expect(screen.queryByText(/Unknown sender/i)).toBeNull();
  expect(screen.queryByText('22.07.2026 13:00')).toBeNull();
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger --runTestsByPath src/app/message-normalizer.spec.ts src/app/message-layout.spec.tsx --runInBand --skip-nx-cache
```

Expected: FAIL because nested attachments and forward context are not consumed.

- [ ] **Step 3: Update client types**

Add:

```ts
export interface MessageAttachment {
  id: string;
  messageId: string;
  mediaId: string;
  fileNameSnapshot: string | null;
  fileSizeSnapshot: number | null;
  mimeSnapshot: string | null;
  category: MessageMediaCategory;
  createdAt: string;
}

export interface MessageForwardContext {
  originalAuthor: {
    id: string;
    nameSnapshot: string;
    displayNameSnapshot: string | null;
  };
  originalMessageCreatedAt: string;
  originalMessageType: MessageType | string;
  preview: {
    text: string | null;
    fileName: string | null;
  };
}
```

`RawMessage` and `Message` get:

```ts
attachments: MessageAttachment[];
forwardContext: MessageForwardContext | null;
```

- [ ] **Step 4: Update normalizer**

Normalize attachments first. Build `Message.media` from first attachment when present:

```ts
function buildAttachmentMedia(raw: RawMessage): MessageMedia | null {
  const attachment = raw.attachments?.[0];
  if (!attachment) return null;
  return {
    fileId: attachment.mediaId,
    contentUrl: `/api/chats/${raw.chatId}/messages/${raw.id}/attachments/${attachment.id}/content`,
    thumbUrl: null,
    fileName: attachment.fileNameSnapshot,
    mime: attachment.mimeSnapshot,
    size: attachment.fileSizeSnapshot,
    category: attachment.category,
    width: null,
    height: null,
    durationMs: null,
    waveform: null,
  };
}
```

Use legacy `buildLegacyMedia` only if no nested attachment exists.

- [ ] **Step 5: Update bubble and file render**

In `MessageBubble`, forward header uses:

```ts
const originalAuthorName = message.forwardContext?.originalAuthor.displayNameSnapshot
  ?? message.forwardContext?.originalAuthor.nameSnapshot
  ?? null;
```

Render only the name in the header. Do not render source date, raw id, `Unknown sender`, or `Forwarded message`.

In file render paths, use `message.media.contentUrl` whenever available.

- [ ] **Step 6: Run GREEN**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger --runTestsByPath src/app/message-normalizer.spec.ts src/app/message-layout.spec.tsx src/app/message-file-rendering.spec.tsx src/app/message-audio-rendering.spec.tsx --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- build @org/pages-chat-page --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/client/entities/message/src/message.types.ts libs/client/entities/message/src/message-normalizer.ts libs/client/entities/message/src/ui/message-bubble.tsx libs/client/entities/message/src/ui/file-message.tsx libs/client/features/send-message/src/use-send-message.ts libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx apps/client/messenger/src/app/message-normalizer.spec.ts apps/client/messenger/src/app/message-layout.spec.tsx apps/client/messenger/src/app/message-file-rendering.spec.tsx apps/client/messenger/src/app/message-audio-rendering.spec.tsx
git commit -m "feat(client): render forwarded clone context"
```

---

### Task 8: Legacy Cleanup

**Files:**
- Modify: `libs/backend/chat/src/database/prisma/schema.prisma`
- Create: `libs/backend/chat/src/database/prisma/migrations/<timestamp>_remove_legacy_message_file_and_forward_fields/migration.sql`
- Modify: `libs/common/src/schemas/chat/message.schema.ts`
- Modify: `libs/common/src/schemas/chat/chat-select.ts`
- Modify: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/client/entities/message/src/message.types.ts`
- Modify: `libs/client/entities/message/src/message-normalizer.ts`
- Modify tests that still reference legacy fields.

**Interfaces:**
- Consumes: Tasks 1-7 nested contracts.
- Produces: clean `Message` without `file*` and `forwardedFrom*`.

- [ ] **Step 1: Search legacy consumers**

Run:

```bash
rg "forwardedFrom|fileId|fileBucket|fileKey|fileName|fileSize|fileMime|fileCategory|/api/media/files" apps libs
```

Expected: only migration files, legacy avatar/media-test routes, and explicitly named transition tests remain.

- [ ] **Step 2: Write failing schema cleanup test**

In common schema tests:

```ts
it('does not expose legacy flattened forward or file fields on messages', () => {
  const keys = Object.keys(messageSchema.shape);
  expect(keys).not.toContain('forwardedFromId');
  expect(keys).not.toContain('forwardedFromSenderId');
  expect(keys).not.toContain('fileId');
  expect(keys).not.toContain('fileKey');
});
```

- [ ] **Step 3: Run RED**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/common --runTestsByPath src/schemas/chat/message-actions.schema.spec.ts --runInBand --skip-nx-cache
```

Expected: FAIL until legacy fields are removed.

- [ ] **Step 4: Remove legacy fields from schemas and Prisma**

Remove from `Message`:

```prisma
fileId
fileBucket
fileKey
fileName
fileSize
fileMime
fileCategory
forwardedFromId
forwardedFromSenderId
forwardedFromCreatedAt
forwardedFromType
forwardedFromText
forwardedFromFileName
```

Migration SQL:

```sql
ALTER TABLE "Message"
  DROP COLUMN IF EXISTS "file_id",
  DROP COLUMN IF EXISTS "file_bucket",
  DROP COLUMN IF EXISTS "file_key",
  DROP COLUMN IF EXISTS "file_name",
  DROP COLUMN IF EXISTS "file_size",
  DROP COLUMN IF EXISTS "file_mime",
  DROP COLUMN IF EXISTS "file_category",
  DROP COLUMN IF EXISTS "forwarded_from_id",
  DROP COLUMN IF EXISTS "forwarded_from_sender_id",
  DROP COLUMN IF EXISTS "forwarded_from_created_at",
  DROP COLUMN IF EXISTS "forwarded_from_type",
  DROP COLUMN IF EXISTS "forwarded_from_text",
  DROP COLUMN IF EXISTS "forwarded_from_file_name";
```

- [ ] **Step 5: Remove legacy client normalization**

Delete `buildLegacyMedia` fallback for chat messages. Keep direct `/api/media/files/:fileId/content` only in avatar/system media-test code if still needed.

- [ ] **Step 6: Run full verification**

Run:

```bash
env NX_ISOLATE_PLUGINS=false npm exec nx -- run @org/chat:prisma-generate
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/common --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/chat --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/media --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/gateway --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- test @org/messenger --runInBand --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- build @org/gateway --skip-nx-cache
env NX_ISOLATE_PLUGINS=false npm exec nx -- build @org/pages-chat-page --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/backend/chat/src/database/prisma/schema.prisma libs/backend/chat/src/database/prisma/migrations libs/common/src/schemas/chat/message.schema.ts libs/common/src/schemas/chat/chat-select.ts libs/backend/chat/src/database/repository/chat.prisma.repo.ts libs/backend/chat/src/services/chat.service.ts libs/client/entities/message/src/message.types.ts libs/client/entities/message/src/message-normalizer.ts apps libs
git commit -m "refactor(chat): remove legacy message media and forward fields"
```

---

## Self-Review

Spec coverage:

- Independent forwarded clone: Task 6.
- Original author context and Telegram-style UI: Tasks 1, 6, 7.
- Message schema cleanup: Tasks 1, 2, 8.
- Independent message attachments: Tasks 2, 5, 7.
- Media references and safe delete: Task 3.
- Context-scoped media access: Task 4 and Task 7.
- Re-forwarding root context: Task 6.
- Observability lifecycle logging: Tasks 3, 4, 5, 6 and Global Constraints.
- No old-data repair job: Global Constraints and Task 8 migration approach.

Placeholder scan:

- No placeholder markers or unnamed future work.
- Each task has exact files, expected interfaces, test commands, and commit commands.

Type consistency:

- `MessageForwardContext`, `MessageAttachment`, `CreateMessageAttachmentData`, and `CreateMessageForwardContextData` are introduced before consumers.
- Attachment content URLs consistently use `chatId/messageId/attachmentId`.
- Legacy flattened fields are explicitly transition-only and removed in Task 8.
