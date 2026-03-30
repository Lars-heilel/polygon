import { io } from 'socket.io-client';

const rawUrl = import.meta.env['VITE_API_URL'] as string | undefined;
const socketUrl = rawUrl
  ? rawUrl.replace(/\/api$/, '')
  : window.location.origin;

export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
});
