import { io } from 'socket.io-client';

// Strip /api suffix to get base socket URL
const rawUrl = import.meta.env['VITE_API_URL'] as string | undefined;
const socketUrl = rawUrl ? rawUrl.replace(/\/api$/, '') : window.location.origin;

export const socket = io(socketUrl, {
  autoConnect: false,
  // auth evaluated at connect time — always picks up the latest token
  auth: (cb: (data: { token: string }) => void) =>
    cb({ token: localStorage.getItem('access_token') ?? '' }),
});
