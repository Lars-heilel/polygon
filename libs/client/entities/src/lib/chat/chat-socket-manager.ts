import { queryClient, socket, toast } from '@org/shared';

import type { Chat, Message } from './chat.api';
import { useChatStore } from './chat.store';

function handleNewMessage(msg: Message) {
  queryClient.setQueryData<Message[]>(['messages', msg.chatId], (old = []) => {
    if (old.some((m) => m.id === msg.id)) return old;
    return [...old, msg];
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
