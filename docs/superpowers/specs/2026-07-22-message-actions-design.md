# Message Actions Design

## Goal

Add Telegram-like message actions to the messenger:

- edit own text messages;
- delete messages either for the current user or for every participant;
- forward messages to another chat, a direct user chat, or Saved Messages;
- copy message text from the message menu.

The work stays on `dev`. No dedicated `chat-system-hardening` branch is used.

## Current State

The backend already has a forward-message foundation:

- `forwardMessageSchema` in `@org/common`;
- `CHAT_PATTERNS.FORWARD_MESSAGES`;
- `ChatService.forwardMessages`;
- gateway route `POST /chats/:id/forward`.

The client does not expose forward UI/API yet. Editing and deleting messages are not implemented.

## Behavior

### Message Menu

Each rendered message gets a compact actions menu attached to the bubble. The menu contains:

- `Edit` for own text-only messages;
- `Forward` for forwardable messages;
- `Copy` for messages with text;
- `Delete` for all visible messages.

Text is copied via the browser clipboard API. Successful copy closes the menu. Copy failure is non-fatal, does not mutate data, and does not write raw message text to logs.

### Editing

Editing is allowed only when all conditions are true:

- current user is the message sender;
- message type is `TEXT`;
- message has no `fileId`;
- new text is non-empty after trimming and at most 4000 characters.

File messages, media messages, voice/audio messages, and captions on file messages are not editable.

The UI reuses the composer: selecting `Edit` loads the existing text into edit mode. Submitting edit mode updates the existing message instead of sending a new message. Cancel returns the composer to normal send mode.

Successful edits update message text and `editedAt`. Clients receive a realtime update and patch their message cache without refetching the whole history.

### Deleting

The `Delete` menu item opens a confirmation modal.

For own messages:

- the modal shows a checkbox `Delete for everyone`;
- the checkbox is checked by default;
- keeping it checked globally deletes the message for all participants;
- unchecking it hides the message only for the current user.

For other users' messages:

- the modal allows only deleting for the current user;
- the `Delete for everyone` checkbox is hidden or disabled.

Deleted messages do not render as placeholders. They are removed from the message stream.

Backend behavior:

- delete-for-me is stored per `(messageId, userId)`;
- delete-for-everyone marks the message globally deleted with metadata;
- history, media history, and normal message APIs exclude globally deleted messages;
- history APIs also exclude messages deleted for the requesting user;
- realtime deletion events remove the message from open clients.

Only the sender can delete a message for everyone. Any chat member can delete a visible message for themselves.

### Forwarding

Selecting `Forward` opens a modal matching the provided Telegram-like reference:

- title `Forward to...`;
- search input at the top;
- first row is `Saved Messages`;
- remaining rows list chats and searchable users;
- rows show avatar, display name, and a small subtitle such as `group`, member count, or recent status where local data supports it.

Clicking a row forwards immediately.

Targets:

- existing chats use the selected chat id;
- `Saved Messages` creates or returns the self chat through `POST /chats/self`, then forwards there;
- users without an existing direct chat create or return a direct chat through `POST /chats/direct`, then forward there.

After a successful forward, the modal closes. The created forwarded messages are broadcast to the target chat through existing realtime delivery. Forwarding to self is supported.

## Data Model

Extend chat Prisma schema:

- `Message.editedAt DateTime? @map("edited_at")`;
- `Message.deletedAt DateTime? @map("deleted_at")`;
- `Message.deletedById String? @map("deleted_by_id")`;
- `MessageDeletion` with `messageId`, `userId`, `deletedAt`.

`MessageDeletion` has a composite id `(messageId, userId)` and cascades on message delete. It stores delete-for-me state that is synced across the user's devices.

Shared message schema adds:

- `editedAt: z.date().nullable()`;
- `deletedAt: z.date().nullable()`;
- `deletedById: z.string().uuid().nullable()`.

Client message types normalize the new timestamps to nullable ISO strings.

## API And Events

Common schemas:

- `editMessageSchema`: `{ text: string }`, trimmed, 1..4000 characters.
- `deleteMessageSchema`: `{ mode: 'ME' | 'EVERYONE' }`.
- extend routes with:
  - `PATCH /chats/:chatId/messages/:messageId`;
  - `DELETE /chats/:chatId/messages/:messageId`;
  - existing `POST /chats/:targetChatId/forward`.

Gateway:

- validates request bodies through shared DTOs;
- sends edit/delete commands to chat service;
- emits `message:updated` after edit;
- emits `message:deleted` after delete-for-everyone;
- emits a targeted `message:hidden` event to the deleting user's sockets after delete-for-me. Add a small `emitToUser(userId, event, payload)` helper to `ChatSocketGateway` using the existing `userSockets` map.

Chat service:

- checks chat membership for all actions;
- checks sender ownership for edit and delete-for-everyone;
- rejects edit attempts on non-text or file-backed messages;
- filters deleted messages in message/media queries.

Search:

- no message-search changes are included in this scope. The current search service indexes users only, so message edit/delete/forward does not add search-service work.

## Client Architecture

`@org/entities-message` owns API calls and cache mutation helpers:

- `editMessage`;
- `deleteMessage`;
- `forwardMessages`;
- mutations for edit/delete/forward;
- cache helpers to update or remove a message across infinite pages.

`@org/pages-chat-page` owns message-row orchestration:

- passes action handlers into message rows;
- opens edit mode in the composer;
- opens delete confirmation modal;
- opens forward modal.

`@org/shared` primitives are reused for menus, modals, buttons, inputs, and avatars. If a generic menu primitive already exists, use it. If not, add the smallest shared primitive needed for this feature and cover it with focused tests.

The forward modal may live in a focused feature package if existing FSD boundaries require it, but it must not pull page-layer code into entities/features.

## Observability

Backend logs use structured events without raw ids or message text:

- `message_edit_requested`;
- `message_edit_rejected`;
- `message_edited`;
- `message_delete_requested`;
- `message_delete_rejected`;
- `message_deleted_for_everyone`;
- `message_deleted_for_user`;
- `message_forward_requested`;
- `message_forwarded`.

Logs include boolean flags such as `hasChatId`, `hasMessageId`, `hasUserId`, counts, mode, and result. They do not include message text, raw ids, file names, or tokens.

## Testing

Use TDD for implementation.

Backend:

- chat service tests for edit ownership, text-only restriction, delete modes, filtering, and forwarding permissions;
- repository tests for global deletion and per-user deletion filtering;
- gateway tests for validation, status codes, and socket broadcast calls.

Client:

- cache helper tests for update/remove behavior across infinite pages;
- message menu tests for action visibility;
- composer edit-mode tests;
- delete modal tests for default checkbox behavior;
- forward modal tests for Saved Messages first, search, user/direct-chat selection, and forward API calls.

Verification uses Nx through `env NX_ISOLATE_PLUGINS=false npm exec nx -- ...`.
