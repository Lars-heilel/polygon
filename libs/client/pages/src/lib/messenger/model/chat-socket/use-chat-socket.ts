import { useEffect } from 'react';

import { useChatStore } from '@org/entities';
import { socket } from '@org/shared';

export function useChatSocket(chatId: string) {
  const setActiveChat = useChatStore((s) => s.setActiveChat);

  useEffect(() => {
    setActiveChat(chatId);
    socket.emit('chat:join', { chatId });

    return () => {
      setActiveChat(null);
      socket.emit('chat:leave', { chatId });
    };
  }, [chatId, setActiveChat]);
}
