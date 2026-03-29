import { useSessionStore } from '@org/entities';
import { socket } from './socket';

// Zustand subscribe — аналог Redux middleware, но без стора и экшенов.
// Первый аргумент — селектор (подписываемся только на accessToken, не весь стор).
// Второй аргумент — колбэк который вызывается когда выбранное значение изменилось.
// Возвращает функцию отписки — вызываем при необходимости (HMR, тесты).
export function initSocketMiddleware(): () => void {
  return useSessionStore.subscribe(
    (state) => state.accessToken,
    (accessToken, prevToken) => {
      if (accessToken && !prevToken) {
        socket.connect();
      } else if (!accessToken && prevToken) {
        socket.disconnect();
      }
    },
  );
}
