import { useSessionStore } from '@org/entities';
import { socket } from './socket';

export function initSocketMiddleware(): () => void {
  return useSessionStore.subscribe(
    (state) => state.isAuthenticated,
    (isAuthenticated, wasAuthenticated) => {
      if (isAuthenticated && !wasAuthenticated) {
        socket.connect();
      } else if (!isAuthenticated && wasAuthenticated) {
        socket.disconnect();
      }
    }
  );
}
