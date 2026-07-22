# Telegram-like Virtual Chat Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-safe foundation for Telegram-like virtual chat: normalized client messages, optimistic socket send dedupe by `clientId`, reusable Virtuoso feed mechanics, and fixed-size media frames.

**Architecture:** Keep TanStack Query as the source of truth for loaded message pages and update it with deterministic `setQueryData` helpers. Introduce compatibility normalization so UI can move toward `message.kind`, `message.media`, and `message.linkPreview` while legacy backend fields still exist. Standardize chat and media virtualization through one reusable shared `VirtualFeed<TItem>` wrapper.

**Tech Stack:** React, TypeScript, TanStack Query v5, Socket.io, react-virtuoso, Zustand, Tailwind CSS, Nx inferred targets, Jest for `@org/messenger`, Vitest for `@org/shared`.

## Global Constraints

- Read `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, and `docs/MONOREPO_GOTCHAS.md` before implementation.
- Run project tasks through Nx with the workspace package manager: `npm exec nx ...`.
- Preserve unrelated WIP in the working tree. Stage only files changed by the current task.
- Use shared UI primitives and semantic tokens for new UI surfaces.
- Add logging for new feature and refactor flows according to `docs/DEVELOPMENT.md`.
- Do not log raw message text, file names, URLs, or other PII.
- Do not call `invalidateQueries(['messages', chatId])` after a normal successful send.
- Message order passed to Virtuoso is `oldest -> newest`.
- Optimistic message keys must remain stable as `client:${clientId}` after server acknowledgement.

---

## File Structure

Create or modify these units:

- `libs/client/entities/message/src/message.types.ts`: target client message types and legacy raw message compatibility types.
- `libs/client/entities/message/src/message-normalizer.ts`: `normalizeMessage`, `normalizeMessagePage`, and helper mapping from legacy `type/fileCategory` to target `kind/media`.
- `libs/client/entities/message/src/message.api.ts`: fetch raw pages, return normalized pages, expose optimistic helper types.
- `libs/client/entities/message/src/index.ts`: export new types and normalizer.
- `apps/client/messenger/src/app/message-normalizer.spec.ts`: Jest coverage for legacy-to-target normalization.
- `apps/client/messenger/src/app/socket/chat-cache-updaters.ts`: deterministic `upsertMessageIntoPages`, send-error marking, chat preview update.
- `apps/client/messenger/src/app/socket/chat-cache-updaters.spec.ts`: dedupe and optimistic replacement tests.
- `libs/client/features/send-message/src/use-send-message.ts`: generate `clientId`, insert optimistic message, emit socket payload.
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx`: pass current user id to `useSendMessage`.
- `apps/client/messenger/src/app/send-message-optimistic.spec.tsx`: hook-level optimistic send test.
- `libs/common/src/schemas/chat/message.schema.ts`: add `clientId`.
- `libs/common/src/schemas/chat/send-message.schema.ts`: accept `clientId`.
- `libs/common/src/schemas/chat/chat-select.ts`: select `clientId`.
- `libs/backend/chat/src/database/prisma/schema.prisma`: persist nullable `clientId`.
- `libs/backend/chat/src/interfaces/chat.interface.ts`: pass `clientId` through service/repository/controller interfaces.
- `libs/backend/chat/src/services/chat.service.ts`: log and pass `clientId`.
- `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`: save `clientId`.
- `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`: accept and forward `clientId`, emit error acknowledgement on failure.
- `libs/client/shared/src/ui/virtual-feed/virtual-feed.tsx`: shared Virtuoso wrapper.
- `libs/client/shared/src/ui/virtual-feed/virtual-feed.spec.tsx`: shared feed tests.
- `libs/client/shared/src/index.ts`: export `VirtualFeed`.
- `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`: migrate to `VirtualFeed`.
- `libs/client/entities/message/src/ui/media-frame.tsx`: fixed-size media frame.
- `libs/client/entities/message/src/ui/file-message.tsx`: use `MediaFrame` for image/video/circle/audio/voice surfaces.
- `apps/client/messenger/src/app/message-file-rendering.spec.tsx`: assert fixed-size media contracts.
- `libs/client/features/user-profile/src/ui/profile-media-panel.tsx`: migrate media panel list to `VirtualFeed`.

---

### Task 1: Normalize Client Message Contract

**Files:**
- Create: `libs/client/entities/message/src/message.types.ts`
- Create: `libs/client/entities/message/src/message-normalizer.ts`
- Modify: `libs/client/entities/message/src/message.api.ts`
- Modify: `libs/client/entities/message/src/index.ts`
- Test: `apps/client/messenger/src/app/message-normalizer.spec.ts`

**Interfaces:**
- Produces: `Message`, `MessageMedia`, `LinkPreview`, `RawMessage`, `MessagePage`, `normalizeMessage(raw: RawMessage): Message`, `normalizeMessagePage(raw: RawMessagePage): MessagePage`.
- Consumes: legacy flat raw fields `fileId`, `fileCategory`, `fileName`, `fileSize`, `fileMime`, `type`.

- [ ] **Step 1: Write the failing normalizer tests**

Create `apps/client/messenger/src/app/message-normalizer.spec.ts`:

```ts
import { normalizeMessage, normalizeMessagePage } from '@org/entities-message';
import type { RawMessage } from '@org/entities-message';

const baseRaw: RawMessage = {
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
  createdAt: '2026-07-22T07:00:00.000Z',
  updatedAt: '2026-07-22T07:00:00.000Z',
  media: null,
  linkPreview: null,
};

describe('message normalization', () => {
  it('normalizes a legacy text message into the target shape', () => {
    const message = normalizeMessage(baseRaw);

    expect(message.kind).toBe('text');
    expect(message.media).toBeNull();
    expect(message.linkPreview).toBeNull();
    expect(message.localStatus).toBeUndefined();
  });

  it('normalizes a legacy image file into message.media with stable content url', () => {
    const message = normalizeMessage({
      ...baseRaw,
      type: 'IMAGE',
      text: null,
      fileId: '44444444-4444-4444-8444-444444444444',
      fileName: 'photo.png',
      fileSize: 1024,
      fileMime: 'image/png',
      fileCategory: 'IMAGE',
    });

    expect(message.kind).toBe('image');
    expect(message.media).toEqual(expect.objectContaining({
      fileId: '44444444-4444-4444-8444-444444444444',
      category: 'IMAGE',
      contentUrl: '/api/media/files/44444444-4444-4444-8444-444444444444/content',
      width: null,
      height: null,
      durationMs: null,
      waveform: null,
    }));
  });

  it('normalizes pages without changing pagination cursor semantics', () => {
    const page = normalizeMessagePage({ messages: [baseRaw], nextCursor: 'cursor-1' });

    expect(page.messages).toHaveLength(1);
    expect(page.nextCursor).toBe('cursor-1');
    expect(page.messages[0].kind).toBe('text');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm exec nx test @org/messenger -- --runInBand message-normalizer.spec.ts
```

Expected: FAIL because `normalizeMessage`, `normalizeMessagePage`, and `RawMessage` are not exported.

- [ ] **Step 3: Add target types**

Create `libs/client/entities/message/src/message.types.ts`:

```ts
import type { MessageType } from '@org/common';

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

export type MessageMediaCategory = 'IMAGE' | 'VIDEO' | 'CIRCLE' | 'AUDIO' | 'VOICE' | 'FILE';

export interface MessageMedia {
  fileId: string;
  contentUrl: string;
  thumbUrl: string | null;
  fileName: string | null;
  mime: string | null;
  size: number | null;
  category: MessageMediaCategory;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  waveform: number[] | null;
}

export interface LinkPreview {
  url: string;
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export interface RawMessage {
  id: string;
  clientId?: string | null;
  chatId: string;
  senderId: string;
  type: MessageType | string;
  text: string | null;
  fileId: string | null;
  fileBucket: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMime: string | null;
  fileCategory: string | null;
  forwardedFromId: string | null;
  createdAt: string;
  updatedAt: string;
  media?: MessageMedia | null;
  linkPreview?: LinkPreview | null;
}

export interface Message {
  id: string;
  clientId: string | null;
  chatId: string;
  senderId: string;
  kind: MessageKind;
  type: MessageType | string;
  text: string | null;
  createdAt: string;
  updatedAt: string;
  media: MessageMedia | null;
  linkPreview: LinkPreview | null;
  localStatus?: LocalMessageStatus;
  fileId: string | null;
  fileBucket: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMime: string | null;
  fileCategory: string | null;
  forwardedFromId: string | null;
}

export interface RawMessagePage {
  messages: RawMessage[];
  nextCursor: string | null;
}

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}
```

- [ ] **Step 4: Add normalizer implementation**

Create `libs/client/entities/message/src/message-normalizer.ts`:

```ts
import type {
  Message,
  MessageKind,
  MessageMedia,
  MessageMediaCategory,
  RawMessage,
  RawMessagePage,
  MessagePage,
} from './message.types';

const mediaCategories = new Set(['IMAGE', 'VIDEO', 'CIRCLE', 'AUDIO', 'VOICE', 'FILE']);

export function normalizeMessage(raw: RawMessage): Message {
  const media = raw.media ?? buildLegacyMedia(raw);
  return {
    ...raw,
    clientId: raw.clientId ?? null,
    kind: resolveKind(raw, media),
    media,
    linkPreview: raw.linkPreview ?? null,
  };
}

export function normalizeMessagePage(raw: RawMessagePage): MessagePage {
  return {
    messages: raw.messages.map(normalizeMessage),
    nextCursor: raw.nextCursor,
  };
}

function buildLegacyMedia(raw: RawMessage): MessageMedia | null {
  if (!raw.fileId) return null;
  const category = normalizeCategory(raw.fileCategory);
  if (!category) return null;

  return {
    fileId: raw.fileId,
    contentUrl: `/api/media/files/${raw.fileId}/content`,
    thumbUrl: null,
    fileName: raw.fileName,
    mime: raw.fileMime,
    size: raw.fileSize,
    category,
    width: null,
    height: null,
    durationMs: null,
    waveform: null,
  };
}

function normalizeCategory(category: string | null): MessageMediaCategory | null {
  if (!category || !mediaCategories.has(category)) return null;
  return category as MessageMediaCategory;
}

function resolveKind(raw: RawMessage, media: MessageMedia | null): MessageKind {
  if (media) {
    switch (media.category) {
      case 'IMAGE':
        return 'image';
      case 'VIDEO':
        return 'video';
      case 'CIRCLE':
        return 'circle';
      case 'AUDIO':
        return 'audio';
      case 'VOICE':
        return 'voice';
      case 'FILE':
        return 'file';
    }
  }

  if (raw.linkPreview) return 'link_preview';
  if (raw.type === 'SYSTEM') return 'system';
  return 'text';
}
```

- [ ] **Step 5: Wire API and exports**

Modify `libs/client/entities/message/src/message.api.ts` so it imports the new types and normalizes fetch results:

```ts
import { API_ROUTES } from '@org/common';
import { authedFetch } from '@org/shared';
import {
  type InfiniteData,
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';

import { normalizeMessage, normalizeMessagePage } from './message-normalizer';
import type { Message, MessagePage, RawMessage, RawMessagePage } from './message.types';

export type { Message, MessagePage, RawMessage, RawMessagePage };

export const messageApi = {
  async getMessages(chatId: string, cursor?: string): Promise<MessagePage> {
    const url = cursor
      ? `${API_ROUTES.chats.messages(chatId)}?cursor=${cursor}`
      : API_ROUTES.chats.messages(chatId);
    const raw = await authedFetch<RawMessagePage>(url);
    return normalizeMessagePage(raw);
  },

  async sendMessage(chatId: string, text: string): Promise<Message> {
    const raw = await authedFetch<RawMessage>(API_ROUTES.chats.messages(chatId), {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return normalizeMessage(raw);
  },
};
```

Keep the existing hooks below this block. Remove the old local `Message` and `MessagePage` type declarations from `message.api.ts`.

Modify `libs/client/entities/message/src/index.ts`:

```ts
export * from './message.api';
export * from './message.types';
export { normalizeMessage, normalizeMessagePage } from './message-normalizer';
```

Preserve any existing exports in `index.ts` by adding these lines rather than deleting UI exports.

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
npm exec nx test @org/messenger -- --runInBand message-normalizer.spec.ts
npm exec nx typecheck @org/entities-message
npm exec nx build @org/messenger
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add libs/client/entities/message/src/message.types.ts \
  libs/client/entities/message/src/message-normalizer.ts \
  libs/client/entities/message/src/message.api.ts \
  libs/client/entities/message/src/index.ts \
  apps/client/messenger/src/app/message-normalizer.spec.ts
git commit -m "feat(client): normalize chat message contract"
```

---

### Task 2: Add Deterministic Message Cache Updaters

**Files:**
- Modify: `apps/client/messenger/src/app/socket/chat-cache-updaters.ts`
- Modify: `apps/client/messenger/src/app/socket/chat-cache-updaters.spec.ts`

**Interfaces:**
- Consumes: `MessagePage` with `pages[].messages`.
- Produces: `upsertMessageIntoPages`, `appendMessageToPages`, `markMessageSendError`, `updateChatListLastMessage`.

- [ ] **Step 1: Extend failing updater tests**

Modify `apps/client/messenger/src/app/socket/chat-cache-updaters.spec.ts`:

```ts
import {
  appendMessageToPages,
  markMessageSendError,
  updateChatListLastMessage,
  upsertMessageIntoPages,
} from './chat-cache-updaters';

describe('chat socket cache updaters', () => {
  const msg = {
    id: 'message-2',
    clientId: null,
    chatId: 'chat-2',
    createdAt: '2026-07-14T10:00:00.000Z',
  };

  it('appends an incoming message to the first message page once', () => {
    const page = {
      pages: [
        { messages: [{ id: 'message-1', clientId: null, chatId: 'chat-2', createdAt: '2026-07-14T09:00:00.000Z' }] },
      ],
    };

    const next = appendMessageToPages(page, msg);
    const duplicate = appendMessageToPages(next, msg);

    expect(next?.pages[0].messages).toHaveLength(2);
    expect(duplicate?.pages[0].messages).toHaveLength(2);
  });

  it('replaces an optimistic message by clientId without appending a duplicate', () => {
    const optimistic = {
      id: 'client-temp-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      createdAt: '2026-07-14T10:00:00.000Z',
      localStatus: 'sending',
    };
    const serverMessage = {
      id: 'server-message-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      createdAt: '2026-07-14T10:00:01.000Z',
    };

    const next = upsertMessageIntoPages({ pages: [{ messages: [optimistic] }] }, serverMessage);

    expect(next?.pages[0].messages).toHaveLength(1);
    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      id: 'server-message-1',
      clientId: 'client-1',
      localStatus: 'sent',
    }));
  });

  it('marks a matching optimistic message as failed by clientId', () => {
    const optimistic = {
      id: 'client-temp-1',
      clientId: 'client-1',
      chatId: 'chat-2',
      createdAt: '2026-07-14T10:00:00.000Z',
      localStatus: 'sending',
    };

    const next = markMessageSendError({ pages: [{ messages: [optimistic] }] }, 'client-1');

    expect(next?.pages[0].messages[0]).toEqual(expect.objectContaining({
      clientId: 'client-1',
      localStatus: 'error',
    }));
  });

  it('updates lastMessage and sorts the changed chat by newest message time', () => {
    const chats = [
      {
        id: 'chat-1',
        updatedAt: '2026-07-14T09:30:00.000Z',
        lastMessage: { id: 'old-1', clientId: null, chatId: 'chat-1', createdAt: '2026-07-14T09:30:00.000Z' },
      },
      {
        id: 'chat-2',
        updatedAt: '2026-07-14T09:00:00.000Z',
        lastMessage: null,
      },
    ];

    const next = updateChatListLastMessage(chats, msg);

    expect(next[0].id).toBe('chat-2');
    expect(next[0].lastMessage).toBe(msg);
    expect(next[0]).not.toHaveProperty('messages');
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm exec nx test @org/messenger -- --runInBand chat-cache-updaters.spec.ts
```

Expected: FAIL because `upsertMessageIntoPages` and `markMessageSendError` are missing.

- [ ] **Step 3: Implement updater semantics**

Replace `apps/client/messenger/src/app/socket/chat-cache-updaters.ts` with:

```ts
type MessageLike = {
  id: string;
  clientId?: string | null;
  chatId: string;
  createdAt: string;
  localStatus?: 'sending' | 'sent' | 'error';
};

type MessagePageLike<TMessage extends MessageLike> = {
  messages: TMessage[];
};

type ChatLike<TMessage extends MessageLike> = {
  id: string;
  updatedAt: string;
  lastMessage: TMessage | null;
};

export function upsertMessageIntoPages<
  TData extends { pages: TPage[] },
  TPage extends MessagePageLike<TMessage>,
  TMessage extends MessageLike,
>(
  old: TData | undefined,
  msg: TMessage,
): TData | undefined {
  if (!old) return old;

  let replaced = false;
  const pages = old.pages.map((page) => ({
    ...page,
    messages: page.messages.map((message) => {
      const sameServerId = message.id === msg.id;
      const sameClientId = Boolean(message.clientId) && message.clientId === msg.clientId;

      if (!sameServerId && !sameClientId) return message;

      replaced = true;
      return {
        ...message,
        ...msg,
        clientId: msg.clientId ?? message.clientId ?? null,
        localStatus: 'sent' as const,
      };
    }),
  }));

  if (replaced) {
    return { ...old, pages } as TData;
  }

  if (pages.some((page) => page.messages.some((message) => message.id === msg.id))) {
    return old;
  }

  return appendMessageToPages({ ...old, pages } as TData, msg);
}

export function appendMessageToPages<
  TData extends { pages: TPage[] },
  TPage extends MessagePageLike<TMessage>,
  TMessage extends MessageLike,
>(
  old: TData | undefined,
  msg: TMessage,
): TData | undefined {
  if (!old) return old;
  if (old.pages.some((page) => page.messages.some((message) => message.id === msg.id))) return old;

  return {
    ...old,
    pages: old.pages.map((page, index) =>
      index === 0 ? { ...page, messages: [...page.messages, msg] } : page,
    ),
  } as TData;
}

export function markMessageSendError<
  TData extends { pages: TPage[] },
  TPage extends MessagePageLike<TMessage>,
  TMessage extends MessageLike,
>(
  old: TData | undefined,
  clientId: string,
): TData | undefined {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.clientId === clientId
          ? { ...message, localStatus: 'error' as const }
          : message,
      ),
    })),
  } as TData;
}

export function updateChatListLastMessage<TChat extends ChatLike<TMessage>, TMessage extends MessageLike>(
  chats: TChat[] | undefined,
  msg: TMessage,
): TChat[] {
  const next = (chats ?? []).map((chat) =>
    chat.id === msg.chatId ? { ...chat, lastMessage: msg } : chat,
  );

  next.sort((left, right) => {
    const leftTime = left.lastMessage?.createdAt ?? left.updatedAt;
    const rightTime = right.lastMessage?.createdAt ?? right.updatedAt;
    return new Date(rightTime).getTime() - new Date(leftTime).getTime();
  });

  return next;
}
```

- [ ] **Step 4: Use upsert in socket manager**

Modify `apps/client/messenger/src/app/socket/chat-socket-manager.ts`:

```ts
import { markMessageSendError, upsertMessageIntoPages, updateChatListLastMessage } from './chat-cache-updaters';
```

Inside `handleNewMessage`, replace `appendMessageToPages(old, msg)` with:

```ts
upsertMessageIntoPages(old, msg)
```

Add a send error handler:

```ts
function handleMessageSendError(payload: { chatId: string; clientId: string }) {
  frontendLog('warn', 'ChatSocket', 'message_send_failed', {
    hasChatId: !!payload.chatId,
    hasClientId: !!payload.clientId,
  });

  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', payload.chatId], (old) =>
    markMessageSendError(old, payload.clientId),
  );
}
```

Register and unregister it:

```ts
socket.on('message:send:error', handleMessageSendError);
socket.off('message:send:error', handleMessageSendError);
```

- [ ] **Step 5: Run tests and build**

```bash
npm exec nx test @org/messenger -- --runInBand chat-cache-updaters.spec.ts
npm exec nx build @org/messenger
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/client/messenger/src/app/socket/chat-cache-updaters.ts \
  apps/client/messenger/src/app/socket/chat-cache-updaters.spec.ts \
  apps/client/messenger/src/app/socket/chat-socket-manager.ts
git commit -m "feat(client): dedupe socket messages by client id"
```

---

### Task 3: Add Client Optimistic Socket Send

**Files:**
- Modify: `libs/client/features/send-message/src/use-send-message.ts`
- Modify: `libs/client/features/send-message/package.json`
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx`
- Test: `apps/client/messenger/src/app/send-message-optimistic.spec.tsx`

**Interfaces:**
- Consumes: `upsertMessageIntoPages(old, optimisticMessage)` from Task 2.
- Produces: `useSendMessage(chatId: string | null, senderId: string | null)`.

- [ ] **Step 1: Write failing optimistic send test**

Create `apps/client/messenger/src/app/send-message-optimistic.spec.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import type { InfiniteData } from '@tanstack/react-query';

import type { MessagePage } from '@org/entities-message';
import { useSendMessage } from '@org/features-send-message';
import { queryClient, socket } from '@org/shared';

describe('useSendMessage optimistic socket send', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('inserts an optimistic message with clientId before emitting the socket event', () => {
    queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', 'chat-1'], {
      pages: [{ messages: [], nextCursor: null }],
      pageParams: [undefined],
    });
    const emit = jest.spyOn(socket, 'emit');

    const { result } = renderHook(() => useSendMessage('chat-1', 'user-1'));

    act(() => {
      result.current.setMessageText('hello');
    });
    act(() => {
      result.current.handleSend();
    });

    const cached = queryClient.getQueryData<InfiniteData<MessagePage>>(['messages', 'chat-1']);
    expect(cached?.pages[0].messages).toHaveLength(1);
    expect(cached?.pages[0].messages[0]).toEqual(expect.objectContaining({
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'hello',
      clientId: expect.any(String),
      localStatus: 'sending',
      kind: 'text',
    }));
    expect(emit).toHaveBeenCalledWith('message:send', expect.objectContaining({
      chatId: 'chat-1',
      text: 'hello',
      clientId: cached?.pages[0].messages[0].clientId,
    }));
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm exec nx test @org/messenger -- --runInBand send-message-optimistic.spec.tsx
```

Expected: FAIL because `useSendMessage` accepts one argument and does not insert optimistic cache data.

- [ ] **Step 3: Add dependency and optimistic insertion**

Modify `libs/client/features/send-message/package.json` dependencies:

```json
"dependencies": {
  "@org/common": "*",
  "@org/entities-message": "*",
  "@org/shared": "*"
}
```

Modify `libs/client/features/send-message/src/use-send-message.ts`:

```ts
import type { InfiniteData } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { frontendLog, queryClient, socket } from '@org/shared';
import type { Message, MessageMediaCategory, MessagePage } from '@org/entities-message';
import { debounce } from 'es-toolkit';
```

Change the hook signature:

```ts
export function useSendMessage(chatId: string | null, senderId: string | null) {
```

Add helper inside the file:

```ts
function createOptimisticMessage(input: {
  clientId: string;
  chatId: string;
  senderId: string;
  text: string | null;
  file?: FileAttachment | null;
}): Message {
  const now = new Date().toISOString();
  const file = input.file ?? null;
  return {
    id: `client:${input.clientId}`,
    clientId: input.clientId,
    chatId: input.chatId,
    senderId: input.senderId,
    kind: file ? getKindFromCategory(file.fileCategory) : 'text',
    type: file ? getMessageTypeFromCategory(file.fileCategory) : 'TEXT',
    text: input.text,
    createdAt: now,
    updatedAt: now,
    media: file
      ? {
          fileId: file.fileId,
          contentUrl: `/api/media/files/${file.fileId}/content`,
          thumbUrl: null,
          fileName: file.fileName,
          mime: file.fileMime,
          size: file.fileSize,
          category: file.fileCategory as MessageMediaCategory,
          width: null,
          height: null,
          durationMs: null,
          waveform: null,
        }
      : null,
    linkPreview: null,
    localStatus: 'sending',
    fileId: file?.fileId ?? null,
    fileBucket: file?.fileBucket ?? null,
    fileKey: file?.fileKey ?? null,
    fileName: file?.fileName ?? null,
    fileSize: file?.fileSize ?? null,
    fileMime: file?.fileMime ?? null,
    fileCategory: file?.fileCategory ?? null,
    forwardedFromId: null,
  };
}

function getKindFromCategory(category: string): Message['kind'] {
  switch (category) {
    case 'IMAGE':
      return 'image';
    case 'VIDEO':
      return 'video';
    case 'CIRCLE':
      return 'circle';
    case 'AUDIO':
      return 'audio';
    case 'VOICE':
      return 'voice';
    default:
      return 'file';
  }
}

function insertOptimisticMessage(chatId: string, message: Message) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page, index) =>
        index === 0 ? { ...page, messages: [...page.messages, message] } : page,
      ),
    };
  });
}
```

In `handleSend`, before each `socket.emit('message:send', ...)`, generate a `clientId`, call `insertOptimisticMessage`, and include `clientId` in the emitted payload.

For text send:

```ts
const clientId = crypto.randomUUID();
const optimistic = createOptimisticMessage({
  clientId,
  chatId: chatIdRef.current,
  senderId,
  text: trimmed,
});
insertOptimisticMessage(chatIdRef.current, optimistic);
socket.emit('message:send', { chatId: chatIdRef.current, text: trimmed, clientId });
```

For file send, pass `file` and include `clientId` in the payload.

Guard send when sender is unavailable:

```ts
if (!chatIdRef.current || !senderId) return;
```

- [ ] **Step 4: Pass sender id from ChatFooter**

Modify `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx`:

```ts
import { useMeSuspenseQuery } from '@org/entities-user';
```

Inside `ChatFooter`:

```ts
const { data: me } = useMeSuspenseQuery();
const { messageText, setMessageText, handleSend, setFileAttachment } = useSendMessage(chatId, me.id);
```

- [ ] **Step 5: Run tests and typecheck**

```bash
npm exec nx test @org/messenger -- --runInBand send-message-optimistic.spec.tsx chat-cache-updaters.spec.ts
npm exec nx typecheck @org/features-send-message
npm exec nx typecheck @org/pages-chat-page
npm exec nx build @org/messenger
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add libs/client/features/send-message/src/use-send-message.ts \
  libs/client/features/send-message/package.json \
  libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/chat-window/ChatFooter.tsx \
  apps/client/messenger/src/app/send-message-optimistic.spec.tsx
git commit -m "feat(client): insert optimistic socket messages"
```

---

### Task 4: Persist and Echo Server Client IDs

**Files:**
- Modify: `libs/common/src/schemas/chat/message.schema.ts`
- Modify: `libs/common/src/schemas/chat/send-message.schema.ts`
- Modify: `libs/common/src/schemas/chat/chat-select.ts`
- Modify: `libs/backend/chat/src/database/prisma/schema.prisma`
- Modify: `libs/backend/chat/src/interfaces/chat.interface.ts`
- Modify: `libs/backend/chat/src/services/chat.service.ts`
- Modify: `libs/backend/chat/src/database/repository/chat.prisma.repo.ts`
- Modify: `libs/backend/chat/src/controllers/chat.controller.ts`
- Modify: `apps/backend/gateway/src/controllers/chat.controller.ts`
- Modify: `apps/backend/gateway/src/gateways/chat.socket-gateway.ts`
- Test: `apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts`
- Test: `libs/backend/chat/src/services/chat.service.spec.ts`

**Interfaces:**
- Consumes: socket payload `clientId?: string`.
- Produces: persisted nullable `Message.clientId`, broadcast message with matching `clientId`, `message:send:error` on socket failure.

- [ ] **Step 1: Write failing gateway socket test**

Add a test in `apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts`:

```ts
it('passes clientId through socket send and broadcasts it with the message', async () => {
  const message = {
    id: 'server-message-1',
    clientId: 'client-1',
    chatId: 'chat-1',
    senderId: 'user-1',
    type: 'TEXT',
    text: 'hello',
    createdAt: new Date('2026-07-22T07:00:00.000Z'),
    updatedAt: new Date('2026-07-22T07:00:00.000Z'),
  };
  chatClient.send.mockReturnValueOnce(of(message));
  const socket = { data: { userId: 'user-1' } } as never;

  await gateway.handleSendMessage(socket, {
    chatId: 'chat-1',
    text: 'hello',
    clientId: 'client-1',
  });

  expect(chatClient.send).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    chatId: 'chat-1',
    senderId: 'user-1',
    text: 'hello',
    clientId: 'client-1',
  }));
  expect(server.to).toHaveBeenCalledWith('chat:chat-1');
  expect(emit).toHaveBeenCalledWith('message:new', expect.objectContaining({
    id: 'server-message-1',
    clientId: 'client-1',
  }));
});
```

- [ ] **Step 2: Run failing backend test**

```bash
npm exec jest -- --config apps/backend/gateway/jest.config.cts --runInBand chat.socket-gateway.spec.ts
```

Expected: FAIL because `clientId` is not accepted or forwarded.

- [ ] **Step 3: Add schema and Prisma field**

Modify `libs/common/src/schemas/chat/message.schema.ts`:

```ts
clientId: z.string().uuid().nullable(),
```

Add it after `id`.

Modify `libs/common/src/schemas/chat/send-message.schema.ts`:

```ts
clientId: z.string().uuid().nullable().optional(),
```

Modify `libs/common/src/schemas/chat/chat-select.ts`:

```ts
clientId: true,
```

Modify `libs/backend/chat/src/database/prisma/schema.prisma`:

```prisma
clientId        String?     @map("client_id")
```

Add an index:

```prisma
@@index([chatId, clientId])
```

Create `libs/backend/chat/src/database/prisma/migrations/20260722000000_add_message_client_id/migration.sql`:

```sql
ALTER TABLE "Message" ADD COLUMN "client_id" TEXT;
CREATE INDEX "Message_chat_id_client_id_idx" ON "Message"("chat_id", "client_id");
```

- [ ] **Step 4: Pass clientId through backend interfaces and service**

Add `clientId?: string | null` to `CreateMessageData`, `IChatService.sendMessage` input, and `IChatController.sendMessage` payload in `libs/backend/chat/src/interfaces/chat.interface.ts`.

Modify `libs/backend/chat/src/services/chat.service.ts` logging:

```ts
hasClientId: !!input.clientId,
```

Pass it to repository:

```ts
clientId: input.clientId ?? null,
```

Forwarded messages must use `clientId: null`.

- [ ] **Step 5: Save clientId in repository**

Modify `libs/backend/chat/src/database/repository/chat.prisma.repo.ts` in `createMessage`:

```ts
clientId: data.clientId ?? null,
```

Modify `createMessagesMany` data mapping:

```ts
clientId: d.clientId ?? null,
```

- [ ] **Step 6: Forward clientId through controllers and socket**

Modify `libs/backend/chat/src/controllers/chat.controller.ts`, `apps/backend/gateway/src/controllers/chat.controller.ts`, and `apps/backend/gateway/src/gateways/chat.socket-gateway.ts` payload types and send calls to include:

```ts
clientId?: string | null;
```

In `ChatSocketGateway.handleSendMessage`, pass:

```ts
clientId: payload.clientId ?? null,
```

On failure, emit:

```ts
if (payload.clientId) {
  socket.emit('message:send:error', {
    chatId: payload.chatId,
    clientId: payload.clientId,
  });
}
```

- [ ] **Step 7: Run backend verification**

```bash
npm exec jest -- --config apps/backend/gateway/jest.config.cts --runInBand chat.socket-gateway.spec.ts
npm exec nx typecheck @org/common
npm exec nx typecheck @org/chat
npm exec nx build @org/messenger
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add libs/common/src/schemas/chat/message.schema.ts \
  libs/common/src/schemas/chat/send-message.schema.ts \
  libs/common/src/schemas/chat/chat-select.ts \
  libs/backend/chat/src/database/prisma/schema.prisma \
  libs/backend/chat/src/database/prisma/migrations/20260722000000_add_message_client_id/migration.sql \
  libs/backend/chat/src/interfaces/chat.interface.ts \
  libs/backend/chat/src/services/chat.service.ts \
  libs/backend/chat/src/database/repository/chat.prisma.repo.ts \
  libs/backend/chat/src/controllers/chat.controller.ts \
  apps/backend/gateway/src/controllers/chat.controller.ts \
  apps/backend/gateway/src/gateways/chat.socket-gateway.ts \
  apps/backend/gateway/src/gateways/chat.socket-gateway.spec.ts \
  libs/backend/chat/src/services/chat.service.spec.ts
git commit -m "feat(chat): echo client ids for socket messages"
```

---

### Task 5: Create Shared VirtualFeed

**Files:**
- Create: `libs/client/shared/src/ui/virtual-feed/virtual-feed.tsx`
- Create: `libs/client/shared/src/ui/virtual-feed/virtual-feed.spec.tsx`
- Create: `libs/client/shared/src/ui/virtual-feed/index.ts`
- Modify: `libs/client/shared/src/index.ts`

**Interfaces:**
- Produces: `VirtualFeed<TItem>`, `VirtualFeedHandle`, `VirtualFeedProps<TItem>`.

- [ ] **Step 1: Write failing VirtualFeed tests**

Create `libs/client/shared/src/ui/virtual-feed/virtual-feed.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { VirtualFeed } from './virtual-feed';

describe('VirtualFeed', () => {
  const items = [
    { id: '1', label: 'one' },
    { id: '2', label: 'two' },
  ];

  it('renders items through the provided renderer', () => {
    render(
      <VirtualFeed
        items={items}
        mode="forward"
        getKey={(item) => item.id}
        renderItem={(item) => <div>{item.label}</div>}
      />,
    );

    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });

  it('renders an empty slot when no items exist', () => {
    render(
      <VirtualFeed
        items={[]}
        mode="reverse"
        getKey={(item: { id: string }) => item.id}
        renderItem={() => null}
        empty={<div>No items</div>}
      />,
    );

    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('uses stable reverse feed data attributes for first item index debugging', () => {
    render(
      <VirtualFeed
        items={items}
        mode="reverse"
        getKey={(item) => item.id}
        renderItem={(item) => <div>{item.label}</div>}
        baseIndex={100}
      />,
    );

    expect(screen.getByTestId('virtual-feed')).toHaveAttribute('data-mode', 'reverse');
    expect(screen.getByTestId('virtual-feed')).toHaveAttribute('data-first-item-index', '98');
  });
});
```

- [ ] **Step 2: Run failing shared test**

```bash
npm exec nx test @org/shared -- --run src/ui/virtual-feed/virtual-feed.spec.tsx
```

Expected: FAIL because `VirtualFeed` does not exist.

- [ ] **Step 3: Implement VirtualFeed**

Create `libs/client/shared/src/ui/virtual-feed/virtual-feed.tsx`:

```tsx
import { forwardRef, memo, useImperativeHandle, useMemo, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

import { cn } from '../../lib/utils/cn';

export interface VirtualFeedHandle {
  scrollToEnd: (behavior?: ScrollBehavior) => void;
}

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
  baseIndex?: number;
  className?: string;
  atBottomThreshold?: number;
  onAtBottomChange?: (isAtBottom: boolean) => void;
}

const DEFAULT_BASE_INDEX = 10_000;

function VirtualFeedInner<TItem>(
  {
    items,
    mode,
    getKey,
    renderItem,
    loadPrevious,
    loadNext,
    hasPrevious,
    hasNext,
    isLoadingPrevious,
    isLoadingNext,
    empty,
    footer,
    floatingAction,
    estimateItemHeight = 80,
    baseIndex = DEFAULT_BASE_INDEX,
    className,
    atBottomThreshold = 24,
    onAtBottomChange,
  }: VirtualFeedProps<TItem>,
  ref: React.ForwardedRef<VirtualFeedHandle>,
) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const firstItemIndex = mode === 'reverse' ? Math.max(0, baseIndex - items.length) : 0;

  useImperativeHandle(ref, () => ({
    scrollToEnd: (behavior = 'smooth') => {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior });
    },
  }));

  const components = useMemo(
    () => ({
      Footer: () => <>{footer}</>,
    }),
    [footer],
  );

  if (items.length === 0 && empty) {
    return (
      <div
        data-testid="virtual-feed"
        data-mode={mode}
        data-first-item-index={firstItemIndex}
        className={cn('relative h-full min-h-0 w-full', className)}
      >
        {empty}
      </div>
    );
  }

  return (
    <div
      data-testid="virtual-feed"
      data-mode={mode}
      data-first-item-index={firstItemIndex}
      className={cn('relative h-full min-h-0 w-full', className)}
    >
      <Virtuoso
        ref={virtuosoRef}
        className="h-full"
        data={items}
        computeItemKey={(_, item) => getKey(item)}
        firstItemIndex={firstItemIndex}
        defaultItemHeight={estimateItemHeight}
        increaseViewportBy={{ top: 600, bottom: 400 }}
        overscan={200}
        skipAnimationFrameInResizeObserver
        initialTopMostItemIndex={mode === 'reverse' && items.length > 0 ? items.length - 1 : 0}
        atBottomThreshold={atBottomThreshold}
        followOutput={mode === 'reverse' ? (bottom) => (bottom ? 'smooth' : false) : false}
        atBottomStateChange={onAtBottomChange}
        startReached={() => {
          if (mode === 'reverse' && hasPrevious && !isLoadingPrevious) loadPrevious?.();
        }}
        endReached={() => {
          if (mode === 'forward' && hasNext && !isLoadingNext) loadNext?.();
        }}
        components={components}
        itemContent={(index, item) => renderItem(item, index)}
      />
      {floatingAction}
    </div>
  );
}

export const VirtualFeed = memo(forwardRef(VirtualFeedInner)) as <TItem>(
  props: VirtualFeedProps<TItem> & React.RefAttributes<VirtualFeedHandle>,
) => React.ReactElement;
```

Create `libs/client/shared/src/ui/virtual-feed/index.ts`:

```ts
export { VirtualFeed } from './virtual-feed';
export type { VirtualFeedHandle, VirtualFeedProps } from './virtual-feed';
```

Modify `libs/client/shared/src/index.ts`:

```ts
export { VirtualFeed } from './ui/virtual-feed';
export type { VirtualFeedHandle, VirtualFeedProps } from './ui/virtual-feed';
```

- [ ] **Step 4: Run shared verification**

```bash
npm exec nx test @org/shared -- --run src/ui/virtual-feed/virtual-feed.spec.tsx
npm exec nx typecheck @org/shared
npm exec nx build @org/shared
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add libs/client/shared/src/ui/virtual-feed/virtual-feed.tsx \
  libs/client/shared/src/ui/virtual-feed/virtual-feed.spec.tsx \
  libs/client/shared/src/ui/virtual-feed/index.ts \
  libs/client/shared/src/index.ts
git commit -m "feat(shared): add virtual feed primitive"
```

---

### Task 6: Migrate Main Chat List to VirtualFeed

**Files:**
- Modify: `libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx`
- Test: `apps/client/messenger/src/app/message-layout.spec.tsx`

**Interfaces:**
- Consumes: `VirtualFeed<Message>` and `VirtualFeedHandle`.
- Produces: chat list without direct Virtuoso wiring.

- [ ] **Step 1: Add regression assertion for stable optimistic keys**

In `apps/client/messenger/src/app/message-layout.spec.tsx`, add a test that renders a message row with `clientId: 'client-1'`. The assertion is:

```ts
expect(screen.getByTestId('message-row')).toHaveAttribute('data-message-client-id', 'client-1');
```

- [ ] **Step 2: Run existing app tests**

```bash
npm exec nx test @org/messenger -- --runInBand message-layout.spec.tsx chat-cache-updaters.spec.ts
```

Expected before implementation: existing tests pass; new stable key test fails until row exposes `data-message-client-id`.

- [ ] **Step 3: Replace direct Virtuoso usage**

In `virtual-message-list.tsx`:

```ts
import type { VirtualFeedHandle } from '@org/shared';
import { Button, Text, VirtualFeed, socket } from '@org/shared';
```

Remove direct `Virtuoso` and `VirtuosoHandle` imports. Replace `virtuosoRef` with:

```ts
const feedRef = useRef<VirtualFeedHandle>(null);
```

Change row data attributes:

```tsx
data-message-client-id={msg.clientId ?? undefined}
```

Replace manual `<Virtuoso />` with:

```tsx
<VirtualFeed
  ref={feedRef}
  mode="reverse"
  items={allMessages}
  getKey={(msg) => (msg.clientId ? `client:${msg.clientId}` : `server:${msg.id}`)}
  estimateItemHeight={80}
  hasPrevious={hasNextPage}
  isLoadingPrevious={isFetchingNextPage}
  loadPrevious={handleStartReached}
  onAtBottomChange={handleAtBottomChange}
  footer={<div className="h-6" />}
  renderItem={(msg) => {
    const profile = memberProfileMap.get(msg.senderId);
    return (
      <ChatMessageRow
        msg={msg}
        isMine={msg.senderId === me.id}
        senderName={profile?.displayName ?? profile?.name ?? undefined}
        senderAvatarUrl={profile?.avatarUrl ?? undefined}
        audioQueue={audioQueue}
        audioQueueIndexByMessageId={audioQueueIndexByMessageId}
      />
    );
  }}
/>
```

Change scroll calls:

```ts
feedRef.current?.scrollToEnd('smooth');
feedRef.current?.scrollToEnd('auto');
```

- [ ] **Step 4: Run verification**

```bash
npm exec nx typecheck @org/pages-chat-page
npm exec nx test @org/messenger -- --runInBand message-layout.spec.tsx chat-cache-updaters.spec.ts
npm exec nx build @org/messenger
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add libs/client/pages/messenger/pages-chat-page/src/lib/ui/chat/message-list/virtual-message-list.tsx \
  apps/client/messenger/src/app/message-layout.spec.tsx
git commit -m "refactor(client): migrate chat messages to virtual feed"
```

---

### Task 7: Add MediaFrame and Fixed Media Surfaces

**Files:**
- Create: `libs/client/entities/message/src/ui/media-frame.tsx`
- Modify: `libs/client/entities/message/src/ui/file-message.tsx`
- Modify: `libs/client/entities/message/src/index.ts`
- Test: `apps/client/messenger/src/app/message-file-rendering.spec.tsx`

**Interfaces:**
- Produces: `MediaFrame`, `getMediaFrameStyle(media, fallback)`.
- Consumes: normalized `message.media`.

- [ ] **Step 1: Extend media rendering tests**

Modify `apps/client/messenger/src/app/message-file-rendering.spec.tsx` to assert fixed contracts:

```tsx
it('reserves an aspect-ratio frame for image messages before asset load', () => {
  render(<FileMessage message={{
    ...baseMessage,
    kind: 'image',
    fileId: 'image-file',
    fileCategory: 'IMAGE',
    media: {
      fileId: 'image-file',
      contentUrl: '/api/media/files/image-file/content',
      thumbUrl: null,
      fileName: 'image.png',
      mime: 'image/png',
      size: 1000,
      category: 'IMAGE',
      width: 1200,
      height: 800,
      durationMs: null,
      waveform: null,
    },
  }} isMine={false} />);

  expect(screen.getByTestId('media-frame')).toHaveStyle({ aspectRatio: '1200 / 800' });
});

it('uses a fixed square frame for circle messages', () => {
  render(<FileMessage message={{
    ...baseMessage,
    kind: 'circle',
    fileId: 'circle-file',
    fileCategory: 'CIRCLE',
    media: {
      fileId: 'circle-file',
      contentUrl: '/api/media/files/circle-file/content',
      thumbUrl: null,
      fileName: 'circle.webm',
      mime: 'video/webm',
      size: 1000,
      category: 'CIRCLE',
      width: null,
      height: null,
      durationMs: 10000,
      waveform: null,
    },
  }} isMine={false} />);

  expect(screen.getByTestId('media-frame')).toHaveClass('h-[200px]', 'w-[200px]', 'sm:h-[240px]', 'sm:w-[240px]');
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm exec nx test @org/messenger -- --runInBand message-file-rendering.spec.tsx
```

Expected: FAIL because `media-frame` does not exist.

- [ ] **Step 3: Implement MediaFrame**

Create `libs/client/entities/message/src/ui/media-frame.tsx`:

```tsx
import type { ReactNode } from 'react';

import { cn } from '@org/shared';

import type { MessageMedia } from '../message.types';

interface MediaFrameProps {
  media: MessageMedia | null;
  kind: 'image' | 'video' | 'circle' | 'audio' | 'voice';
  children: ReactNode;
  className?: string;
}

export function MediaFrame({ media, kind, children, className }: MediaFrameProps) {
  if (kind === 'circle') {
    return (
      <div
        data-testid="media-frame"
        className={cn('h-[200px] w-[200px] overflow-hidden rounded-full bg-surface-elevated sm:h-[240px] sm:w-[240px]', className)}
      >
        {children}
      </div>
    );
  }

  if (kind === 'audio' || kind === 'voice') {
    return (
      <div
        data-testid="media-frame"
        className={cn('h-16 min-w-64 overflow-hidden rounded-lg border border-border bg-surface-elevated', className)}
      >
        {children}
      </div>
    );
  }

  const width = media?.width && media.width > 0 ? media.width : 16;
  const height = media?.height && media.height > 0 ? media.height : 9;

  return (
    <div
      data-testid="media-frame"
      className={cn('overflow-hidden rounded-lg border border-border bg-surface-elevated', className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {children}
    </div>
  );
}
```

Export it from `libs/client/entities/message/src/index.ts`:

```ts
export { MediaFrame } from './ui/media-frame';
```

- [ ] **Step 4: Use MediaFrame in FileMessage**

In `libs/client/entities/message/src/ui/file-message.tsx`, wrap image/video/circle/audio/voice outer content with:

```tsx
<MediaFrame media={message.media} kind="image">
  ...
</MediaFrame>
```

Use exact kind per renderer. The wrapper must be the outer stable box around the image/video/audio player surface. Keep existing `data-testid` values used by tests.

- [ ] **Step 5: Run verification**

```bash
npm exec nx test @org/messenger -- --runInBand message-file-rendering.spec.tsx message-audio-rendering.spec.tsx
npm exec nx typecheck @org/entities-message
npm exec nx build @org/messenger
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add libs/client/entities/message/src/ui/media-frame.tsx \
  libs/client/entities/message/src/ui/file-message.tsx \
  libs/client/entities/message/src/index.ts \
  apps/client/messenger/src/app/message-file-rendering.spec.tsx
git commit -m "feat(client): reserve stable media message frames"
```

---

### Task 8: Migrate Profile Media Panel to VirtualFeed

**Files:**
- Modify: `libs/client/features/user-profile/src/ui/profile-media-panel.tsx`
- Modify: `libs/client/features/user-profile/src/index.ts`
- Test: `apps/client/messenger/src/app/user-profile-modal.spec.tsx`

**Interfaces:**
- Consumes: `VirtualFeed<FlatItem>` in forward mode.
- Produces: media panel with standardized virtualization mechanics.

- [ ] **Step 1: Export ProfileMediaPanel and fix profile modal test import**

Modify `libs/client/features/user-profile/src/index.ts`:

```ts
export { ProfileMediaPanel } from './ui/profile-media-panel';
```

In `apps/client/messenger/src/app/user-profile-modal.spec.tsx`, mock the public module path:

```ts
jest.mock('@org/features-user-profile', () => ({
  ...jest.requireActual('@org/features-user-profile'),
  ProfileMediaPanel: ({ chatId }: { chatId: string }) => <div data-testid="profile-media-panel">{chatId}</div>,
}));
```

Add an assertion that the media panel can render with a virtual feed container:

```ts
expect(screen.getByTestId('profile-media-panel')).toBeInTheDocument();
```

- [ ] **Step 2: Run failing or currently broken test**

```bash
npm exec nx test @org/messenger -- --runInBand user-profile-modal.spec.tsx
```

Expected before fix: FAIL while the old private mock path is still used. Expected after mock/export correction and before panel migration: PASS.

- [ ] **Step 3: Replace direct Virtuoso in profile media panel**

Modify `libs/client/features/user-profile/src/ui/profile-media-panel.tsx` imports:

```ts
import { MediaViewer, Spinner, Text, VirtualFeed, cn, formatTime, type MediaViewerItem } from '@org/shared';
```

Remove:

```ts
import { Virtuoso } from 'react-virtuoso';
```

Replace the `<Virtuoso />` block with:

```tsx
<VirtualFeed
  mode="forward"
  items={flatItems}
  getKey={(item) => item.type === 'header' ? `header:${item.label}` : `entry:${item.entry.id}`}
  hasNext={hasNextPage}
  isLoadingNext={isFetchingNextPage}
  loadNext={() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }}
  footer={isFetchingNextPage ? (
    <div className="flex justify-center py-4">
      <Spinner size="sm" />
    </div>
  ) : null}
  renderItem={(item) => {
    if (item.type === 'header') {
      return (
        <div className="sticky top-0 z-10 bg-background/95 px-1 py-2 text-xs font-medium text-text-muted backdrop-blur">
          {item.label}
        </div>
      );
    }

    const profile = profiles.get(item.entry.message.senderId);
    const isMine = item.entry.message.senderId === me.id;

    return (
      <MediaEntryCard
        entry={item.entry}
        isMine={isMine}
        senderName={profile?.displayName ?? profile?.name ?? 'Unknown'}
        onOpenViewer={() => {
          const nextIndex = visualItems.findIndex((visualItem) => visualItem.id === item.entry.id);
          if (nextIndex >= 0) {
            setViewerIndex(nextIndex);
          }
        }}
      />
    );
  }}
/>
```

- [ ] **Step 4: Run verification**

```bash
npm exec nx test @org/messenger -- --runInBand user-profile-modal.spec.tsx
npm exec nx typecheck @org/features-user-profile
npm exec nx build @org/messenger
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add libs/client/features/user-profile/src/ui/profile-media-panel.tsx \
  libs/client/features/user-profile/src/index.ts \
  apps/client/messenger/src/app/user-profile-modal.spec.tsx
git commit -m "refactor(client): reuse virtual feed in profile media"
```

---

## Final Verification

Run after all tasks:

```bash
npm exec nx test @org/messenger -- --runInBand message-normalizer.spec.ts chat-cache-updaters.spec.ts send-message-optimistic.spec.tsx message-file-rendering.spec.tsx message-audio-rendering.spec.tsx user-profile-modal.spec.tsx
npm exec nx test @org/shared -- --run src/ui/virtual-feed/virtual-feed.spec.tsx
npm exec nx typecheck @org/shared
npm exec nx typecheck @org/entities-message
npm exec nx typecheck @org/features-send-message
npm exec nx typecheck @org/pages-chat-page
npm exec nx typecheck @org/features-user-profile
npm exec nx build @org/messenger
```

Expected: all commands pass. Nx Cloud may print an authentication/cache warning; that warning is not a task failure when the command exit code is 0.

## Self-review Notes

- Spec coverage: Tasks 1-4 cover normalized contract, `clientId`, optimistic dedupe, and cache protocol. Tasks 5-8 cover shared virtualization, chat migration, media frame size contract, and media panel reuse. Logging is included in Tasks 2-4.
- Backend media metadata persistence is intentionally limited to `clientId` in this foundation plan. Image/video dimensions, duration, waveform, and backend link preview storage need a second backend-media plan after the client list/cache foundation is stable.
- High-frequency typing/read isolation is already partially present through Zustand. A separate plan should harden TTL/debounce and read marker stores after message insertion stops mutating the list unnecessarily.
