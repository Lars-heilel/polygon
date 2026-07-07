import { useEffect } from 'react';

import { useChatStore } from '@org/entities-chat';
import { socket } from '@org/shared';

export function useChatSocket(chatId: string) {
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const markChatRead = useChatStore((s) => s.markChatRead);

  useEffect(() => {
    setActiveChat(chatId);
    markChatRead(chatId);
    socket.emit('chat:join', { chatId });

    return () => {
      setActiveChat(null);
      socket.emit('chat:leave', { chatId });
    };
  }, [chatId, markChatRead, setActiveChat]);
}
