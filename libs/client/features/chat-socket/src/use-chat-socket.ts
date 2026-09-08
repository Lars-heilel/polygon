import { useEffect, useRef } from 'react';

import { chatApi, type Chat, useChatStore } from '@org/entities-chat';
import type { Message } from '@org/entities-message';
import { frontendLog, queryClient, socket } from '@org/shared';

const MARK_READ_DEBOUNCE_MS = 1000;

export function useChatSocket(chatId: string) {
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const markChatRead = useChatStore((s) => s.markChatRead);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveChat(chatId);
    frontendLog('debug', 'ChatSocket', 'chat_join_requested', { hasChatId: !!chatId });
    void chatApi.markRead(chatId).catch(() => undefined);
    markChatRead(chatId);
    queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
      old.map((chat) => (chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)),
    );
    socket.emit('chat:join', { chatId });

    return () => {
      setActiveChat(null);
      socket.emit('chat:leave', { chatId });
    };
  }, [chatId, markChatRead, setActiveChat]);

  useEffect(() => {
    const markActiveRead = () => {
      const activeId = chatIdRef.current;
      if (!activeId || document.visibilityState !== 'visible') return;
      void chatApi.markRead(activeId).catch(() => undefined);
      queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
        old.map((chat) => (chat.id === activeId ? { ...chat, unreadCount: 0 } : chat)),
      );
    };

    const onVisibilityChange = () => {
      markActiveRead();
    };
    const onFocus = () => {
      markActiveRead();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    const onNewMessage = (msg: Message) => {
      if (!msg || msg.chatId !== chatIdRef.current) return;
      if (document.visibilityState !== 'visible') return;
      const me = queryClient.getQueryData<{ id: string }>(['me']);
      if (me && msg.senderId === me.id) return;
      if (markReadTimerRef.current !== null) clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = setTimeout(() => {
        markReadTimerRef.current = null;
        markActiveRead();
      }, MARK_READ_DEBOUNCE_MS);
    };
    socket.on('message:new', onNewMessage);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      socket.off('message:new', onNewMessage);
      if (markReadTimerRef.current !== null) {
        clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = null;
      }
    };
  }, [chatId]);
}
