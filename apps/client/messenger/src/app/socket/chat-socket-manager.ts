import type { Chat } from '@org/entities-chat';
import { useChatStore } from '@org/entities-chat';
import type { Message, MessagePage } from '@org/entities-message';
import { queryClient, socket } from '@org/shared';
import type { InfiniteData } from '@tanstack/react-query';

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
