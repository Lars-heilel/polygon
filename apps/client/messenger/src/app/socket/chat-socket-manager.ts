import type { Chat } from '@org/entities-chat';
import { useChatStore } from '@org/entities-chat';
import { usePresenceStore } from '@org/entities-chat';
import type { Message, MessagePage } from '@org/entities-message';
import { queryClient, socket } from '@org/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { unstable_batchedUpdates } from 'react-dom';

function handleNewMessage(msg: Message) {
  unstable_batchedUpdates(() => {
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
  });

  useChatStore.getState().setLastReceivedMessage(msg);
}

function handleUserOnline(payload: { userId: string; chatId: string }) {
  usePresenceStore.getState().setOnline(payload.userId);
}

function handleUserOffline(payload: { userId: string; chatId: string }) {
  usePresenceStore.getState().setOffline(payload.userId);
}

function handleUserTyping(payload: { userId: string; chatId: string; isTyping: boolean }) {
  useChatStore.getState().setIsTyping(payload.userId, payload.isTyping);
}

export function initChatSocketManager(): () => void {
  socket.on('message:new', handleNewMessage);
  socket.on('user:online', handleUserOnline);
  socket.on('user:offline', handleUserOffline);
  socket.on('user:typing', handleUserTyping);

  return () => {
    socket.off('message:new', handleNewMessage);
    socket.off('user:online', handleUserOnline);
    socket.off('user:offline', handleUserOffline);
    socket.off('user:typing', handleUserTyping);
  };
}
