import { useSessionStore } from '@org/entities-user';
import type { Chat } from '@org/entities-chat';
import { useChatStore } from '@org/entities-chat';
import { queryClient, socket } from '@org/shared';

import { initChatSocketManager } from './chat-socket-manager';

export function rejoinAllChats(): void {
  const chats = queryClient.getQueryData<Chat[]>(['chats']) ?? [];
  const ids = new Set(chats.map((chat) => chat.id));
  const activeChatId = useChatStore.getState().activeChatId;
  if (activeChatId) {
    ids.add(activeChatId);
  }
  for (const chatId of ids) {
    socket.emit('chat:join', { chatId });
  }
}

export function initSocketMiddleware(): () => void {
  let cleanupChatManager: (() => void) | null = null;

  socket.on('connect', rejoinAllChats);

  const unsubscribeSession = useSessionStore.subscribe(
    (state) => state.isAuthenticated,
    (isAuthenticated, wasAuthenticated) => {
      if (isAuthenticated && !wasAuthenticated) {
        socket.connect();
        cleanupChatManager = initChatSocketManager();
      } else if (!isAuthenticated && wasAuthenticated) {
        cleanupChatManager?.();
        cleanupChatManager = null;
        socket.disconnect();
      }
    },
  );

  return () => {
    socket.off('connect', rejoinAllChats);
    unsubscribeSession();
  };
}
