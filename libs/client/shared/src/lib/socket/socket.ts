import { io } from 'socket.io-client';

export const socket = io(window.location.origin, {
  autoConnect: false,
  withCredentials: true,
  // кластер gateway на shared-порту: polling нельзя приstickить, только websocket
  transports: ['websocket'],
});
