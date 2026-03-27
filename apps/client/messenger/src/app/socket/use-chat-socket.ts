import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { chatApi, type Message } from '../store/chat-api';
import { socket } from './socket';

export function useChatSocket(chatId: string) {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.emit('chat:join', { chatId });

    const handleMessage = (msg: Message) => {
      dispatch(
        chatApi.util.updateQueryData('getMessages', chatId, (draft) => {
          if (!draft.find((m) => m.id === msg.id)) {
            draft.push(msg);
          }
        }),
      );
    };

    socket.on('message:new', handleMessage);

    return () => {
      socket.emit('chat:leave', { chatId });
      socket.off('message:new', handleMessage);
    };
  }, [chatId, dispatch]);
}
