import type { InfiniteData } from '@tanstack/react-query';

import type { Chat, Message, MessagePage } from '@org/entities';
import { useChatStore } from '@org/entities';
import { queryClient, socket } from '@org/shared';

function handleNewMessage(msg: Message) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', msg.chatId], (old) => {
    if (!old) return old;
    if (old.pages.some((page) => page.messages.some((m) => m.id === msg.id))) return old;

    return {
      ...old,
      pages: old.pages.map((page, i) =>
        i === 0 ? { ...page, messages: [...page.messages, msg] } : page,
      ),
    };
  });

  queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
    old.map((chat) => (chat.id === msg.chatId ? { ...chat, messages: [msg] } : chat)),
  );

  useChatStore.getState().setLastReceivedMessage(msg);
}

export function initChatSocketManager(): () => void {
  socket.on('message:new', handleNewMessage);
  return () => socket.off('message:new', handleNewMessage);
}
