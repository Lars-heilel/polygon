import { io } from 'socket.io-client';
import { useSessionStore } from '@org/entities';

const rawUrl = import.meta.env['VITE_API_URL'] as string | undefined;
const socketUrl = rawUrl ? rawUrl.replace(/\/api$/, '') : window.location.origin;

export const socket = io(socketUrl, {
  autoConnect: false,
  // auth колбэк вызывается при каждом connect/reconnect —
  // всегда подхватывает актуальный токен из Zustand стора
  auth: (cb: (data: { token: string }) => void) =>
    cb({ token: useSessionStore.getState().accessToken ?? '' }),
});
