import { useSessionStore } from './session.store';
import { socket } from '@org/shared';

import { initChatSocketManager } from '../chat/chat-socket-manager';

export function initSocketMiddleware(): () => void {
  let cleanupChatManager: (() => void) | null = null;

  return useSessionStore.subscribe(
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
}
