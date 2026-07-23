# Chat Service Specification

## Purpose

The Chat Service owns direct and self chats, messages, participant read state, media references, and the data returned to the Messenger SPA.

## Implemented Capabilities

- Creates and lists direct chats and idempotent one-user saved-message chats.
- Returns cursor-paginated message history enriched for client rendering.
- Sends text and attachment messages, with client IDs available for optimistic reconciliation.
- Supports image, video, audio, voice, circle-video, and document/media attachment references.
- Edits an author's text-only message.
- Deletes a message for everyone or hides it for the requesting participant, subject to authorization.
- Updates per-member read markers and unread counts.
- Forwards messages into another accessible chat with original-author and original-message-date snapshots.
- Returns chat media and link references for the client media panel and link display.
- Extracts link-preview data for message rendering.

## Runtime Contracts

- A participant may access only chats and messages they belong to.
- Message pages use a cursor rather than an unbounded history response.
- Attachment references are retained when a message is forwarded, while the forwarded copy retains its own immutable source-author snapshot.
- Socket.IO transports message creation, update, deletion, read state, basic presence, and typing events to connected clients.

## Acceptance Criteria

- **CHAT-1:** Direct and saved-message chats can be created and listed without duplicate self chats.
- **CHAT-2:** Messages are cursor-paginated and enriched for the client message renderer.
- **CHAT-3:** Text and attachment messages support optimistic client updates and Socket.IO delivery.
- **CHAT-4:** Forwarded messages preserve the original author snapshot and original message date.
- **CHAT-5:** Editing, deleting for everyone, and deleting for self update HTTP cache and socket listeners.
- **CHAT-6:** Read-state updates maintain unread counters and active-chat state.
- **CHAT-7:** Basic online/offline presence and typing indicators are relayed for active chat use.

## Exclusions

Group chats, group calls, peer-to-peer calls, message full-text search/indexing, last-seen, custom statuses, and user blocking are not provided by the current chat product.
