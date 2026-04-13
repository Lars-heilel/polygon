# Client Libs Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести messenger-специфичные хуки из `features/chat/` в `pages/messenger/model/`, удалить дубликаты компонентов из `widgets`, очистить `shared/ui/layouts/` дубликат.

**Architecture:** Хуки переезжают в `pages/messenger/model/` — FSD-сегмент `model` страницы. `widgets` очищается от messenger-компонентов (UI уже живёт в `pages/messenger/ui/` — актуальные версии). `features` остаётся только с переиспользуемыми сценариями (auth, theme, search).

**Tech Stack:** TypeScript, React 19, Nx monorepo, FSD, Zustand, TanStack Query

---

## Карта файлов

### Создаются
- `libs/client/pages/src/lib/messenger/model/use-chat-list.ts`
- `libs/client/pages/src/lib/messenger/model/use-chat-window.ts`
- `libs/client/pages/src/lib/messenger/model/use-create-chat.ts`
- `libs/client/pages/src/lib/messenger/model/use-send-message.ts`
- `libs/client/pages/src/lib/messenger/model/chat-socket/use-chat-socket.ts`
- `libs/client/pages/src/lib/messenger/model/chat-socket/socket-middleware.ts`
- `libs/client/pages/src/lib/messenger/ui/send-message-form/send-message-form.tsx`

### Изменяются
- `libs/client/pages/src/lib/messenger/index.ts` — добавить экспорт `initSocketMiddleware`
- `libs/client/pages/src/lib/messenger/ui/chat-list-sidebar/chat-list-sidebar.tsx` — импорты `useChatList`, `useCreateChat` → из model
- `libs/client/pages/src/lib/messenger/ui/chat-window/chat-window.tsx` — импорт `useChatWindow` → из model
- `libs/client/pages/src/lib/messenger/ui/message-input/message-input.tsx` — импорт `SendMessageForm` → из sibling
- `libs/client/features/src/index.ts` — удалить экспорты chat-специфичных хуков
- `libs/client/widgets/src/index.ts` — очистить
- `apps/client/messenger/src/app/main.tsx` — `initSocketMiddleware` из `@org/pages`

### Удаляются
- `libs/client/features/src/lib/chat/` (вся папка)
- `libs/client/widgets/src/lib/` (весь контент)
- `libs/client/shared/src/ui/layouts/auth-layout.tsx`
- `libs/client/shared/src/ui/layouts/index.ts`

---

## Task 1: Создать `pages/messenger/model/` — перенести хуки

**Files:**
- Create: `libs/client/pages/src/lib/messenger/model/use-chat-list.ts`
- Create: `libs/client/pages/src/lib/messenger/model/use-chat-window.ts`
- Create: `libs/client/pages/src/lib/messenger/model/use-send-message.ts`
- Create: `libs/client/pages/src/lib/messenger/model/chat-socket/use-chat-socket.ts`
- Create: `libs/client/pages/src/lib/messenger/model/chat-socket/socket-middleware.ts`

- [ ] **Создать `use-chat-list.ts`**

```ts
// libs/client/pages/src/lib/messenger/model/use-chat-list.ts
import { useMemo, useState } from 'react';

import { useGetChatsQuery, useMeQuery } from '@org/entities';

export function useChatList() {
  const { data: chats, isLoading } = useGetChatsQuery();
  const { data: me } = useMeQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    if (!chats) return [];

    return chats
      .map((chat) => {
        const otherMember = chat.members.find((m) => m.userId !== me?.id);
        return {
          id: chat.id,
          name: otherMember?.userId.slice(0, 8) ?? chat.name ?? 'Chat',
          lastMessage: chat.messages?.[0]?.text ?? 'No messages yet',
          time: chat.messages?.[0]?.createdAt ?? '',
          unread: 0,
          online: false,
        };
      })
      .filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [chats, me, searchQuery]);

  return {
    chats: filteredChats,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedChatId,
    setSelectedChatId,
  };
}
```

- [ ] **Создать `use-chat-window.ts`**

```ts
// libs/client/pages/src/lib/messenger/model/use-chat-window.ts
import { useState } from 'react';

import { useGetMessagesQuery, useMeQuery, useSendMessageMutation } from '@org/entities';

export function useChatWindow(chatId: string | null) {
  const { data: messages, isLoading } = useGetMessagesQuery(chatId ?? '');
  const { data: me } = useMeQuery();
  const [messageText, setMessageText] = useState('');

  const sendMessageMutation = useSendMessageMutation(chatId ?? '');

  const handleSend = () => {
    const trimmed = messageText.trim();
    if (!trimmed || !chatId) return;

    sendMessageMutation.mutate(trimmed, {
      onError: () => {
        setMessageText(trimmed);
      },
    });
  };

  return {
    messages: messages ?? [],
    isLoading,
    currentUserId: me?.id ?? '',
    messageText,
    setMessageText,
    isSending: sendMessageMutation.isPending,
    handleSend,
  };
}
```

- [ ] **Создать `use-send-message.ts`**

```ts
// libs/client/pages/src/lib/messenger/model/use-send-message.ts
import { useCallback, useState } from 'react';

import { useSendMessageMutation } from '@org/entities';
import { toast } from '@org/shared';

export function useSendMessage(chatId: string) {
  const [text, setText] = useState('');
  const { mutate, isPending } = useSendMessageMutation(chatId);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    setText('');
    mutate(trimmed, {
      onError: () => {
        toast.error('Failed to send message');
        setText(trimmed);
      },
    });
  }, [text, isPending, mutate]);

  return {
    text,
    setText,
    send,
    isSending: isPending,
  };
}
```

- [ ] **Создать `chat-socket/use-chat-socket.ts`**

```ts
// libs/client/pages/src/lib/messenger/model/chat-socket/use-chat-socket.ts
import { useEffect } from 'react';

import type { Message } from '@org/entities';
import { socket } from '@org/shared';
import { useQueryClient } from '@tanstack/react-query';

export function useChatSocket(chatId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.emit('chat:join', { chatId });

    const handleMessage = (msg: Message) => {
      queryClient.setQueryData<Message[]>(['messages', chatId], (old = []) => {
        if (old.find((m) => m.id === msg.id)) return old;
        return [...old, msg];
      });
    };

    socket.on('message:new', handleMessage);

    return () => {
      socket.emit('chat:leave', { chatId });
      socket.off('message:new', handleMessage);
    };
  }, [chatId, queryClient]);
}
```

- [ ] **Создать `chat-socket/socket-middleware.ts`**

```ts
// libs/client/pages/src/lib/messenger/model/chat-socket/socket-middleware.ts
import { useSessionStore } from '@org/entities';
import { socket } from '@org/shared';

export function initSocketMiddleware(): () => void {
  return useSessionStore.subscribe(
    (state) => state.isAuthenticated,
    (isAuthenticated, wasAuthenticated) => {
      if (isAuthenticated && !wasAuthenticated) {
        socket.connect();
      } else if (!isAuthenticated && wasAuthenticated) {
        socket.disconnect();
      }
    },
  );
}
```

- [ ] **Создать `use-create-chat.ts`**

```ts
// libs/client/pages/src/lib/messenger/model/use-create-chat.ts
import { useState } from 'react';

import { useCreateDirectChatMutation } from '@org/entities';
import { useSearchUsers } from '@org/features';

export function useCreateChat() {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: createChat, isPending } = useCreateDirectChatMutation();

  const search = useSearchUsers();

  const handleSelectUser = (targetUserId: string) => {
    createChat(
      { targetUserId },
      {
        onSuccess: () => {
          setIsOpen(false);
          search.onChange('');
        },
      },
    );
  };

  return {
    isOpen,
    setIsOpen,
    searchQuery: search.inputValue,
    setSearchQuery: search.onChange,
    users: search.results,
    isSearching: search.isLoading,
    isCreating: isPending,
    onSelectUser: handleSelectUser,
  };
}
```

- [ ] **Commit**

```bash
git add libs/client/pages/src/lib/messenger/model/
git commit -m "feat(pages): add messenger/model with chat hooks from features"
```

---

## Task 2: Перенести `SendMessageForm` в `pages/messenger/ui/`

**Files:**
- Create: `libs/client/pages/src/lib/messenger/ui/send-message-form/send-message-form.tsx`

- [ ] **Создать `send-message-form.tsx`**

```tsx
// libs/client/pages/src/lib/messenger/ui/send-message-form/send-message-form.tsx
import { type KeyboardEvent } from 'react';

import { Button, Textarea } from '@org/shared';

import { useSendMessage } from '../../model/use-send-message';

interface SendMessageFormProps {
  chatId: string;
}

export function SendMessageForm({ chatId }: SendMessageFormProps) {
  const { text, setText, send, isSending } = useSendMessage(chatId);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          maxChars={4000}
          disabled={isSending}
        />
      </div>
      <Button
        onClick={send}
        disabled={!text.trim() || isSending}
        size="md"
      >
        Send
      </Button>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add libs/client/pages/src/lib/messenger/ui/send-message-form/
git commit -m "feat(pages): move SendMessageForm to messenger/ui"
```

---

## Task 3: Обновить импорты в `pages/messenger/ui/`

**Files:**
- Modify: `libs/client/pages/src/lib/messenger/ui/chat-list-sidebar/chat-list-sidebar.tsx`
- Modify: `libs/client/pages/src/lib/messenger/ui/chat-window/chat-window.tsx`
- Modify: `libs/client/pages/src/lib/messenger/ui/message-input/message-input.tsx`

- [ ] **Обновить `chat-list-sidebar.tsx` — заменить импорты хуков**

Заменить строку:
```ts
import { useChatList, useCreateChat, useSearchUsers } from '@org/features';
```
На:
```ts
import { useSearchUsers } from '@org/features';

import { useChatList } from '../../model/use-chat-list';
import { useCreateChat } from '../../model/use-create-chat';
```

- [ ] **Обновить `chat-window.tsx` — заменить импорт `useChatWindow`**

Заменить строку:
```ts
import { useChatWindow } from '@org/features';
```
На:
```ts
import { useChatWindow } from '../../model/use-chat-window';
```

- [ ] **Обновить `message-input.tsx` — заменить импорт `SendMessageForm`**

Заменить строку:
```ts
import { SendMessageForm } from '@org/features';
```
На:
```ts
import { SendMessageForm } from '../send-message-form/send-message-form';
```

- [ ] **Commit**

```bash
git add libs/client/pages/src/lib/messenger/ui/
git commit -m "refactor(pages): update messenger/ui imports to use local model"
```

---

## Task 4: Обновить `pages` messenger index — экспортировать `initSocketMiddleware`

**Files:**
- Modify: `libs/client/pages/src/lib/messenger/index.ts`

- [ ] **Добавить экспорт `initSocketMiddleware`**

```ts
// libs/client/pages/src/lib/messenger/index.ts
export { ChatsLayout } from './chats-layout';
export { MessengerMainPage } from './messenger-main-page';
export { ChatPage } from './chat-page';
export { initSocketMiddleware } from './model/chat-socket/socket-middleware';
```

- [ ] **Commit**

```bash
git add libs/client/pages/src/lib/messenger/index.ts
git commit -m "feat(pages): export initSocketMiddleware from pages public API"
```

---

## Task 5: Обновить импорт `initSocketMiddleware` в приложении

**Files:**
- Modify: `apps/client/messenger/src/app/main.tsx`

- [ ] **Прочитать текущий `main.tsx`**

```bash
cat apps/client/messenger/src/app/main.tsx
```

- [ ] **Заменить импорт**

Заменить:
```ts
import { initSocketMiddleware } from '@org/features';
```
На:
```ts
import { initSocketMiddleware } from '@org/pages';
```

- [ ] **Commit**

```bash
git add apps/client/messenger/src/app/main.tsx
git commit -m "refactor(messenger): import initSocketMiddleware from @org/pages"
```

---

## Task 6: Очистить `features` — удалить chat-специфичный код

**Files:**
- Modify: `libs/client/features/src/index.ts`
- Delete: `libs/client/features/src/lib/chat/` (вся папка)

- [ ] **Обновить `features/src/index.ts` — удалить chat-экспорты**

```ts
// libs/client/features/src/index.ts
export * from './lib/auth';
export * from './lib/theme';
export { useSearchUsers } from './lib/search/use-search-users';
```

- [ ] **Удалить папку `features/src/lib/chat/`**

```bash
rm -rf libs/client/features/src/lib/chat/
```

- [ ] **Commit**

```bash
git add libs/client/features/src/
git commit -m "refactor(features): remove messenger-specific chat code"
```

---

## Task 7: Очистить `widgets` lib

**Files:**
- Modify: `libs/client/widgets/src/index.ts`
- Delete: `libs/client/widgets/src/lib/` (весь контент)

- [ ] **Очистить `widgets/src/index.ts`**

```ts
// libs/client/widgets/src/index.ts
// Reserved for future reusable widgets shared across apps
```

- [ ] **Удалить папку `widgets/src/lib/`**

```bash
rm -rf libs/client/widgets/src/lib/
```

- [ ] **Commit**

```bash
git add libs/client/widgets/src/
git commit -m "refactor(widgets): clear messenger-specific components, reserve for future use"
```

---

## Task 8: Удалить дубликат `AuthLayout` из `shared`

**Files:**
- Delete: `libs/client/shared/src/ui/layouts/auth-layout.tsx`
- Delete: `libs/client/shared/src/ui/layouts/index.ts`

- [ ] **Убедиться что ничего не импортирует из `shared/ui/layouts`**

```bash
grep -rn "from '@org/shared'.*Layout\|shared.*layouts" libs/ apps/ --include="*.ts" --include="*.tsx"
```

Ожидаемый результат: совпадений нет (AuthLayout не экспортируется из `shared/src/index.ts`).

- [ ] **Удалить файлы**

```bash
rm libs/client/shared/src/ui/layouts/auth-layout.tsx
rm libs/client/shared/src/ui/layouts/index.ts
rmdir libs/client/shared/src/ui/layouts/
```

- [ ] **Commit**

```bash
git add libs/client/shared/src/ui/layouts/
git commit -m "refactor(shared): remove duplicate AuthLayout (lives in @org/layouts)"
```

---

## Task 9: Финальная верификация

- [ ] **Запустить typecheck для затронутых пакетов**

```bash
npx nx run-many -t typecheck -p @org/pages @org/features @org/widgets @org/shared @org/messenger
```

Ожидаемый результат: все 5 пакетов — `✔ typecheck`

- [ ] **Запустить lint**

```bash
npx nx run-many -t lint -p @org/pages @org/features @org/widgets @org/shared @org/messenger
```

Ожидаемый результат: все 5 пакетов — `✔ lint`

- [ ] **Запустить build**

```bash
npx nx build @org/messenger
```

Ожидаемый результат: `✔ build` без ошибок

- [ ] **Если всё зелёное — финальный коммит не нужен, таски уже закоммичены пошагово**
