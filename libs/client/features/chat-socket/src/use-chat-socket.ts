import { useEffect } from 'react';

import { chatApi, useChatStore } from '@org/entities-chat';
import { frontendLog, socket } from '@org/shared';

export function useChatSocket(chatId: string) {
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const markChatRead = useChatStore((s) => s.markChatRead);

  useEffect(() => {
    setActiveChat(chatId);
    frontendLog('debug', 'ChatSocket', 'chat_join_requested', { hasChatId: !!chatId });
    void chatApi.markRead(chatId).catch(() => undefined);
    markChatRead(chatId);
    socket.emit('chat:join', { chatId });

    return () => {
      setActiveChat(null);
      socket.emit('chat:leave', { chatId });
    };
  }, [chatId, markChatRead, setActiveChat]);
}
