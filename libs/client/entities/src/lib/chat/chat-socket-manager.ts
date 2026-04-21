import type { InfiniteData } from '@tanstack/react-query';
import { queryClient, socket, toast } from '@org/shared';

import type { Message, MessagePage } from '../message/message.api';
import type { Chat } from './chat.api';
import { useChatStore } from './chat.store';

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
    old.map((chat) =>
      chat.id === msg.chatId ? { ...chat, messages: [msg] } : chat,
    ),
  );

  const activeChatId = useChatStore.getState().activeChatId;
  if (msg.chatId !== activeChatId) {
    toast('New message');
  }
}

export function initChatSocketManager(): () => void {
  socket.on('message:new', handleNewMessage);
  return () => socket.off('message:new', handleNewMessage);
}
