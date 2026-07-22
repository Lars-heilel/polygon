# Forwarded Message Clone Design

## Goal

Forwarding creates a fully independent message clone in the target chat. Runtime rendering, search, notifications, media playback, and message history must not read the source chat or source message after the clone has been created.

The UI must match the Telegram-style model:

- the message belongs to the current chat and has its own sender and timestamp;
- a compact header inside the bubble shows the original author name;
- the body renders as a normal text/media/file message;
- no `Unknown sender`, raw ids, or original-message timestamps are shown in the bubble.

## Current Problems

The current `Message` model has grown forward-specific fields:

- `forwardedFromId`
- `forwardedFromSenderId`
- `forwardedFromCreatedAt`
- `forwardedFromType`
- `forwardedFromText`
- `forwardedFromFileName`

This mixes two responsibilities:

- current-chat message state;
- original-message provenance and display context.

Media is also stored inline on `Message` through `fileId`, `fileBucket`, `fileKey`, `fileName`, `fileSize`, `fileMime`, and `fileCategory`. The client renders chat media through `/api/media/files/:fileId/content`, and gateway authorization checks `File.chatId`. That is not strong enough for independent cloned attachments because access is tied to a media file's original chat, not to the target chat message that owns the visible attachment.

## Target Model

### Message

`Message` describes only the message in the current chat:

- `id`
- `clientId`
- `chatId`
- `senderId`
- `type`
- `text`
- `editedAt`
- `deletedAt`
- `deletedById`
- `createdAt`
- `updatedAt`

For a forwarded message, `senderId` is the user who forwarded the message into the target chat. It is not the original author.

### MessageForwardContext

`MessageForwardContext` is a one-to-one child of the cloned target `Message`.

Fields:

- `messageId`
- `originalMessageId`
- `originalChatId`
- `originalAuthorId`
- `originalAuthorNameSnapshot`
- `originalAuthorDisplayNameSnapshot`
- `originalMessageCreatedAt`
- `originalMessageType`
- `originalTextPreview`
- `originalFileNamePreview`
- `snapshotVersion`
- `createdAt`

The original ids are retained for diagnostics and optional future navigation only. They must not be used as runtime display data.

The author name snapshot is required. Gateway may refresh or enrich profiles for other surfaces, but the chat bubble must be able to render the original author from Chat DB alone.

### MessageAttachment

`MessageAttachment` is a chat-owned attachment row for a specific message.

Fields:

- `id`
- `messageId`
- `mediaId`
- `fileNameSnapshot`
- `fileSizeSnapshot`
- `mimeSnapshot`
- `category`
- `createdAt`

For forwarding, the target message receives new `MessageAttachment` rows. The attachment rows are independent even if they refer to the same physical media asset.

### Media File

`Media.File` remains the physical asset metadata:

- `id`
- `bucket`
- `key`
- `originalName`
- `mimeType`
- `size`
- `category`
- `status`
- `uploaderId`
- `createdAt`
- `updatedAt`

`File.chatId` is legacy upload context, not the final authorization boundary for chat media.

### MediaReference

The media service tracks references so physical objects are not deleted while any message attachment still uses them.

Fields:

- `id`
- `fileId`
- `ownerType`
- `ownerId`
- `createdAt`

For message media, `ownerType = MESSAGE_ATTACHMENT` and `ownerId = MessageAttachment.id`.

## Access Model

Chat media content must be accessed through chat/message/attachment context:

```txt
GET /api/chats/:chatId/messages/:messageId/attachments/:attachmentId/content
```

Authorization order:

1. The user is a member of `chatId`.
2. `messageId` belongs to `chatId`.
3. `attachmentId` belongs to `messageId`.
4. The attachment points to `mediaId`.
5. Gateway streams the media object's bucket/key only after those checks pass.

The direct route below becomes legacy and must not be used by chat message rendering:

```txt
GET /api/media/files/:fileId/content
```

It may remain temporarily for avatars, diagnostics, or legacy test pages, but chat UI must migrate away from it.

## Forwarding Flow

1. Client calls `POST /api/chats/:targetChatId/forward`.
2. Gateway asks Chat Service to prepare the source messages for the current user.
3. Chat Service validates source membership and target membership.
4. Chat Service returns source message payloads and original author ids, not raw source-chat render dependencies.
5. Gateway calls User Service with original author ids.
6. Gateway builds author snapshots.
7. Gateway sends a clone command to Chat Service containing source payloads plus author snapshots.
8. Chat Service creates, in a transaction:
   - the target `Message`;
   - cloned `MessageAttachment` rows;
   - `MessageForwardContext`;
   - media references for the new attachments.
9. Gateway broadcasts and returns the created target messages.

After step 8, runtime reads only target `Message`, `MessageForwardContext`, and target `MessageAttachment`.

## Re-forwarding

If a forwarded message is forwarded again, the new message preserves the root original author context.

Rules:

- message body and attachments are cloned from the visible source message;
- forward context is copied from the source message's existing `MessageForwardContext` when present;
- otherwise, context is built from the source message itself.

This avoids chains like "forwarded from the user who forwarded it last" when the visible product expectation is the original author.

## Delete And Edit Semantics

Original source message changes must not affect clones:

- editing the original does not update forwarded clones;
- deleting the original does not remove forwarded clones;
- deleting a forwarded clone does not affect the original;
- deleting a message removes its message attachments and media references, but physical media is deleted only when no references remain.

For current test-mode data, no repair job is required. The new contract applies to new forwarded messages after migration.

## API Shape

Messages expose nested context and attachment objects:

```ts
type Message = {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  text: string | null;
  attachments: MessageAttachment[];
  forwardContext: MessageForwardContext | null;
  createdAt: string;
  updatedAt: string;
};

type MessageForwardContext = {
  originalAuthor: {
    id: string;
    nameSnapshot: string;
    displayNameSnapshot: string | null;
  };
  originalMessageCreatedAt: string;
  originalMessageType: MessageType;
  preview: {
    text: string | null;
    fileName: string | null;
  };
};
```

Flattened `forwardedFrom*` and `file*` fields are legacy transition fields and are removed after consumers are migrated.

## UI Behavior

The message bubble should render:

- sender/avatar from the current chat message as today;
- if `forwardContext` exists, a compact accent header with `originalAuthor.displayNameSnapshot ?? originalAuthor.nameSnapshot`;
- normal message content below the header;
- current message timestamp in the bottom meta row.

The bubble must not render:

- `Unknown sender`;
- raw user ids;
- generic `Forwarded message` for healthy new data;
- original message timestamp as a separate visible line.

If `forwardContext` is present but the author snapshot is missing, the UI may render `Forwarded` as an emergency fallback and frontend/backend diagnostics should log the missing snapshot without raw ids or message text.

## Observability

Backend logs must be structured and must not include raw ids, message text, file names, presigned URLs, bucket names, object keys, or tokens.

Required events:

- `message_forward_prepare_requested`
- `message_forward_prepare_denied`
- `message_forward_author_snapshot_requested`
- `message_forward_author_snapshot_missing`
- `message_forward_clone_requested`
- `message_forward_clone_created`
- `message_forward_clone_failed`
- `message_attachment_clone_created`
- `media_reference_created`
- `media_reference_delete_skipped`
- `media_file_gc_deleted`

Logs should use boolean flags and counts, such as `hasSourceChatId`, `hasTargetChatId`, `messageCount`, `attachmentCount`, `missingAuthorSnapshotCount`, and `referenceCount`.

## Migration Strategy

Because the feature is not in production, migration can prioritize clean forward behavior over preserving old test data.

Recommended stages:

1. Add `MessageForwardContext`, `MessageAttachment`, and `MediaReference`.
2. Update read paths to return nested `forwardContext` and `attachments`.
3. Update send/upload paths to create `MessageAttachment` instead of relying on inline `Message.file*` fields.
4. Update forward paths to clone messages, attachments, forward context, and media references.
5. Update client normalization and rendering to consume nested objects.
6. Move chat media rendering to context-scoped attachment URLs.
7. Remove or deprecate direct chat media usage of `/api/media/files/:fileId/content`.
8. Remove legacy `Message.forwardedFrom*` and `Message.file*` fields when all consumers are migrated.

## Testing Strategy

Backend:

- forward creates target message, target attachments, media references, and forward context in one transaction;
- forwarded clone still renders after source message deletion;
- forwarded clone keeps old content after source message edit;
- user in target chat cannot access source attachment route;
- user can access cloned target attachment route;
- physical media is not deleted while references exist;
- structured logs avoid raw ids/text/file names/keys.

Frontend:

- forwarded text, file, audio, voice, image, and video messages render with original author header;
- no `Unknown sender`, raw ids, or source timestamps appear in the bubble;
- media URLs are built from `chatId/messageId/attachmentId`, not `fileId`;
- old empty states remain stable on mobile and desktop.

## Non-goals

- No physical object copy per forward.
- No repair job for old test forwarded messages.
- No runtime join from forwarded messages back to the source chat for display.
- No direct client access to MinIO or object keys.
