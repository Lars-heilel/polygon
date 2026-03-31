import { useEffect } from 'react';

import type { Message } from '@org/entities';
import { useQueryClient } from '@tanstack/react-query';

import { socket } from './socket';

export function useChatSocket(chatId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.emit('chat:join', { chatId });

    const handleMessage = (msg: Message) => {
      queryClient.setQueryData<Message[]>(['messages', chatId], (old = []) => {
        if (old.find((m) => m.id === msg.id)) return old; // дедупликация
        return [...old, msg];
      });
    };

    socket.on('message:new', handleMessage);

    return () => {
      socket.emit('chat:leave', { chatId });
      socket.off('message:new', handleMessage);
    };
  }, [chatId, queryClient]);
}
