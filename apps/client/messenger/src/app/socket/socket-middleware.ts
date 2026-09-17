import type { Chat } from '@org/entities-chat';
import { useChatStore } from '@org/entities-chat';
import { useSessionStore } from '@org/entities-user';
import { ensureDeviceEnrolled } from '@org/features-auth';
import { queryClient, socket } from '@org/shared';

import { initChatSocketManager, resyncActiveChats } from './chat-socket-manager';

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
  void resyncActiveChats().catch(() => undefined);
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
        // Covers password login, OAuth callback, and session restore:
        // verifies the browser device against the server, enrolling fresh
        // when the record is missing or belongs to another user.
        void ensureDeviceEnrolled().catch(() => undefined);
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
