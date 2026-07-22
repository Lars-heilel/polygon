# Telegram-like Virtual Chat Architecture Design

## Goal

Build a reliable Telegram-like chat rendering architecture for dynamic message history, realtime updates, and heavy media content. The system must keep scroll position stable during reverse pagination, avoid duplicate optimistic/socket messages, and prevent media layout shift in both the main chat and media panels.

This design covers the shared data contract, TanStack Query cache protocol, reusable virtual feed abstraction, message/media rendering contract, and high-frequency socket event isolation.

## Current Problems

The current implementation has useful pieces but no single architecture boundary:

- `VirtualMessageList` already uses `react-virtuoso` with `firstItemIndex`, `startReached`, `followOutput`, `computeItemKey`, and bottom tracking.
- Message data is still mostly flat: `fileId`, `fileCategory`, `fileName`, `fileSize`, `fileMime`.
- Socket send does not pass a `clientId`, so optimistic messages cannot be matched reliably with server broadcasts.
- Existing cache helpers deduplicate by server `id`, but not by `clientId`.
- Some message mutation code still invalidates `['messages', chatId]` after send, which causes unnecessary refetch and list churn.
- Media lists exist in more than one place and each owns its own Virtuoso logic.
- Heavy content does not have a complete backend-provided size contract, so image/video/link preview rendering can still shift after asset load.

## Design Choice

Use a staged migration to a normalized message contract while preserving backward compatibility with the existing flat fields during the transition.

Do not rewrite the app in one cut. Introduce a `normalizeMessage(raw)` boundary and shared cache/list primitives first, then migrate renderers and backend persistence behind that boundary.

## Message Contract

The target client message shape is:

```ts
export type MessageKind =
  | 'text'
  | 'markdown'
  | 'image'
  | 'video'
  | 'circle'
  | 'audio'
  | 'voice'
  | 'file'
  | 'link_preview'
  | 'system';

export type LocalMessageStatus = 'sending' | 'sent' | 'error';

export interface Message {
  id: string;
  clientId: string | null;
  chatId: string;
  senderId: string;
  kind: MessageKind;
  text: string | null;
  createdAt: string;
  updatedAt: string;
  media: MessageMedia | null;
  linkPreview: LinkPreview | null;
  localStatus?: LocalMessageStatus;
}
```

Media metadata is part of the message payload:

```ts
export interface MessageMedia {
  fileId: string;
  contentUrl: string;
  thumbUrl: string | null;
  fileName: string | null;
  mime: string | null;
  size: number | null;
  category: 'IMAGE' | 'VIDEO' | 'CIRCLE' | 'AUDIO' | 'VOICE' | 'FILE';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  waveform: number[] | null;
}
```

Link preview data must be backend-produced, cached, and returned with the message:

```ts
export interface LinkPreview {
  url: string;
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}
```

During migration, existing backend DTOs may still expose `fileId`, `fileCategory`, `fileName`, `fileSize`, `fileMime`, `fileBucket`, and `fileKey`. The client must normalize those fields into `message.media` at the API boundary so UI components stop branching on legacy fields.

## Server Response Contract

History endpoints and socket broadcasts must use the same message shape. The history endpoint returns messages from newest-page pagination, but the client presents them oldest-to-newest.

```ts
export interface MessagePageDto {
  items: MessageDto[];
  pageInfo: {
    nextCursor: string | null;
    hasMoreBefore: boolean;
  };
}
```

Required backend additions:

- Persist and return `clientId` for socket-sent messages.
- Persist or derive media dimensions for `IMAGE`, `VIDEO`, and `CIRCLE`.
- Persist or derive `durationMs` for `VIDEO`, `CIRCLE`, `AUDIO`, and `VOICE`.
- Persist waveform samples for `VOICE` and optionally `AUDIO`.
- Attach backend-parsed `linkPreview` data to messages that include previewable links.

Backend parsing must happen outside row rendering. The client message list must not fetch link preview data while rendering a message row.

## Cache Protocol

TanStack Query remains the source of truth for loaded message pages. Socket events update query data manually with `queryClient.setQueryData`; they do not invalidate the message query for ordinary message delivery.

Optimistic send flow:

1. Client generates `clientId = crypto.randomUUID()`.
2. Client inserts an optimistic message into `['messages', chatId]` with `localStatus: 'sending'`.
3. Client emits `message:send` with `clientId` and message payload.
4. Backend saves or echoes `clientId`.
5. Backend broadcasts `message:new`.
6. Socket handler upserts the server message by matching either server `id` or `clientId`.
7. Matched optimistic message is replaced in place and becomes `localStatus: 'sent'`.
8. If send fails, the optimistic message stays in place with `localStatus: 'error'`.

Conceptual updater:

```ts
export function upsertMessageIntoPages(old, incoming) {
  if (!old) return old;

  let replaced = false;
  const pages = old.pages.map((page) => ({
    ...page,
    items: page.items.map((message) => {
      const sameServerId = message.id === incoming.id;
      const sameClientId =
        Boolean(message.clientId) && message.clientId === incoming.clientId;

      if (!sameServerId && !sameClientId) return message;

      replaced = true;
      return {
        ...incoming,
        clientId: incoming.clientId ?? message.clientId,
        localStatus: 'sent',
      };
    }),
  }));

  if (replaced) {
    return { ...old, pages };
  }

  if (pages.some((page) => page.items.some((message) => message.id === incoming.id))) {
    return old;
  }

  return appendToNewestPage({ ...old, pages }, incoming);
}
```

Allowed invalidation cases:

- Reconnect recovery after missed socket events.
- Manual refresh.
- Hard integrity mismatch, such as duplicate server ids or page cursor mismatch.

Do not call `invalidateQueries(['messages', chatId])` after a normal successful send.

## Virtuoso Reverse Pagination

Message order passed to Virtuoso must be `oldest -> newest`.

Required Virtuoso setup for the chat feed:

- `data={messages}`
- `computeItemKey={(_, message) => message.clientId ? \`client:${message.clientId}\` : \`server:${message.id}\`}`
- `firstItemIndex={BASE_INDEX - messages.length}`
- `startReached={loadOlderMessages}`
- `followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}`
- `atBottomStateChange={setIsAtBottom}`
- `atBottomThreshold={24}`
- `increaseViewportBy={{ top: 600, bottom: 400 }}`
- `initialTopMostItemIndex={messages.length - 1}`

When older pages are prepended, `messages.length` grows and `firstItemIndex` moves backward by the same amount. Virtuoso can then preserve the top visible item instead of jumping the viewport.

Optimistic messages must keep a stable key after server acknowledgement. If a message has `clientId`, the Virtuoso key remains `client:${clientId}` even after the server `id` arrives.

The floating "new messages" affordance appears only when:

- user is not at bottom, and
- a message arrives after the user left the bottom.

Clicking it scrolls to `index: 'LAST'`, `align: 'end'`.

## Shared Virtual Feed

Introduce a reusable virtual list primitive for chat and media lists:

```ts
export interface VirtualFeedProps<TItem> {
  items: TItem[];
  mode: 'reverse' | 'forward';
  getKey: (item: TItem) => string;
  renderItem: (item: TItem, index: number) => React.ReactNode;
  loadPrevious?: () => void;
  loadNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  isLoadingPrevious?: boolean;
  isLoadingNext?: boolean;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
  floatingAction?: React.ReactNode;
  estimateItemHeight?: number;
}
```

`VirtualFeed` owns:

- Virtuoso wiring.
- `firstItemIndex` for reverse mode.
- start/end reached behavior.
- stable keys.
- bottom state.
- empty/loading/footer slots.
- optional floating action positioning.

Consumers own:

- data fetching hook,
- item normalization,
- item renderer,
- domain actions.

Main chat uses `VirtualFeed<Message>` in `reverse` mode. Profile/media panels use `VirtualFeed<MediaEntry>` in `forward` mode. This keeps list mechanics standardized without coupling media panels to chat message UI.

## Message Component Architecture

Message rendering is split into stable layers:

- `MessageRow`: row spacing, avatar, sender metadata, test ids, delivery status slot.
- `MessageBubble`: visual shell and ownership styling.
- `MessageRenderer`: switches on `message.kind`.
- `MediaFrame`: reserves stable dimensions before asset load.
- Specialized renderers: `TextMessage`, `MarkdownMessage`, `ImageMessage`, `VideoMessage`, `CircleMessage`, `AudioMessage`, `VoiceMessage`, `FileMessage`, `LinkPreviewMessage`.

`MessageRenderer` must not fetch data. It renders from message payload only.

## Layout Contract

Heavy content must reserve its final outer size before loading assets:

- `image`: aspect ratio from `media.width / media.height`; fallback `16 / 9`.
- `video`: aspect ratio from `media.width / media.height`; fallback `16 / 9`.
- `circle`: fixed square, desktop `240px`, compact/mobile `200px`.
- `voice`: fixed container height, target `56px` or `64px`.
- `audio`: fixed container height for compact player; waveform must render inside the fixed height.
- `file`: fixed minimum row height with bounded filename and size text.
- `link_preview`: bounded card with `max-height` and `overflow: hidden`.

`MediaFrame` applies the size contract:

```tsx
<div
  className="overflow-hidden rounded-lg border border-border bg-surface-elevated"
  style={{ aspectRatio: `${width || 16} / ${height || 9}` }}
>
  {children}
</div>
```

The outer frame must not resize when an image, video metadata, waveform renderer, or thumbnail finishes loading.

## High-frequency Events

Typing, presence, read markers, and delivery updates must not mutate the main message pages array on every event.

Use isolated state:

- typing: Zustand state keyed by `chatId -> userId`, with debounce and TTL cleanup.
- presence: separate presence store.
- read markers: separate store keyed by `chatId`, optionally by member id.
- delivery status: separate map keyed by `messageId` if updates are frequent.

Rows that need these values should read narrow selectors through small subcomponents. The main `messages` array should only change for message insertion, optimistic replacement, edit, delete, or hard recovery.

Socket handlers should batch related updates with `unstable_batchedUpdates` where they update both message pages and chat list preview.

## Logging Requirements

All new chat data-flow features must follow the repository observability requirement:

- log message send requested, optimistic inserted, send acknowledged, send failed;
- log socket message received and whether it inserted, replaced, or deduplicated;
- log hard recovery invalidations;
- log pagination failures and cursor mismatches;
- do not log message text, file names, URLs, or raw PII.

Logs should use existing shared/frontend logger and structured backend logger patterns.

## Migration Plan Outline

1. Add target types and `normalizeMessage(raw)` at the client API boundary.
2. Add message cache updater utilities with `clientId` replacement semantics.
3. Add socket send `clientId` support and remove normal send invalidation.
4. Introduce `VirtualFeed<TItem>` and migrate `VirtualMessageList`.
5. Migrate profile/media panels to `VirtualFeed`.
6. Add `MediaFrame` and convert image/video/circle/audio/voice/link preview renderers.
7. Extend backend DTO/schema for `clientId` and media/link metadata.
8. Add tests for dedupe, reverse pagination stability, media fixed-size rendering, and no list rerender for typing.

## Testing Strategy

Unit tests:

- `normalizeMessage` maps legacy flat fields to target `media`.
- `upsertMessageIntoPages` replaces by `clientId`.
- duplicate socket events do not append duplicates.
- failed optimistic send marks `localStatus: 'error'`.
- `MediaFrame` computes stable aspect ratio and fixed fallback dimensions.

Component tests:

- `VirtualFeed` calls `loadPrevious` in reverse mode and preserves key mapping.
- `VirtualMessageList` shows floating new-message button only when not at bottom.
- media panel uses the same feed mechanics and pagination slots.

E2E tests:

- scrolling older history does not jump the visible anchor message.
- receiving a new message while reading history does not scroll down.
- receiving a new message at bottom follows smoothly.
- image/video/circle/voice/audio messages keep stable row dimensions before and after asset load.

## Non-goals

- This design does not replace TanStack Query with a custom normalized entity store.
- This design does not introduce a new markdown engine unless current parsing proves insufficient.
- This design does not require all backend metadata migrations to happen in the first implementation step.
- This design does not redesign the visual theme beyond using shared tokens and layout contracts.
