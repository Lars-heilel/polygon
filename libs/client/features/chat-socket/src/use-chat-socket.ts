import { useEffect, useRef } from 'react';

import { type Chat, chatApi, useChatStore } from '@org/entities-chat';
import {
  type Message,
  type MessagePage,
  type RawMessage,
  appendMessageToPages,
  decryptIncomingMessage,
  deleteCachedMessage,
  removeMessageFromPages,
  updateMessageInPages,
  writeMessagesToCache,
} from '@org/entities-message';
import { frontendLog, queryClient, socket } from '@org/shared';
import type { InfiniteData } from '@tanstack/react-query';

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

    // Retry the join if the socket reconnects while this chat is open —
    // the global rejoin covers the list, this covers a chat opened before
    // the first snapshot arrived.
    const retryJoin = () => {
      socket.emit('chat:join', { chatId: chatIdRef.current });
    };
    socket.on('connect', retryJoin);

    return () => {
      socket.off('connect', retryJoin);
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

  useEffect(() => {
    // Undecryptable live payloads are skipped (no cache write): the retry
    // action and the next delta sync recover them once keys arrive. Caching
    // a placeholder here could overwrite a decryptable entry on update.
    const skipUndecryptable = (message: Message, raw: RawMessage): boolean => {
      if (!message.undecryptable) return false;
      frontendLog('warn', 'ChatSocket', 'live_message_undecryptable_skipped', {
        hasChatId: !!raw.chatId,
        hasMessageId: !!raw.id,
      });
      return true;
    };
    const onCacheNewMessage = (raw: RawMessage) => {
      if (!raw || raw.chatId !== chatIdRef.current) return;
      void decryptIncomingMessage(raw)
        .then((message) => {
          if (skipUndecryptable(message, raw)) return;
          queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', message.chatId], (old) =>
            appendMessageToPages<InfiniteData<MessagePage>, Message>(old, message),
          );
          return writeMessagesToCache(message.chatId, [message]);
        })
        .catch(() => {
          frontendLog('warn', 'ChatSocket', 'live_message_decrypt_failed', {
            hasChatId: !!raw.chatId,
            hasMessageId: !!raw.id,
          });
        });
    };
    const onCacheUpdatedMessage = (raw: RawMessage) => {
      if (!raw || raw.chatId !== chatIdRef.current) return;
      void decryptIncomingMessage(raw)
        .then((message) => {
          if (skipUndecryptable(message, raw)) return;
          queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', message.chatId], (old) =>
            updateMessageInPages<InfiniteData<MessagePage>, Message>(old, message),
          );
          return writeMessagesToCache(message.chatId, [message]);
        })
        .catch(() => {
          frontendLog('warn', 'ChatSocket', 'live_message_decrypt_failed', {
            hasChatId: !!raw.chatId,
            hasMessageId: !!raw.id,
          });
        });
    };
    const onCacheDeletedMessage = (payload: { chatId: string; messageId: string }) => {
      if (!payload || payload.chatId !== chatIdRef.current) return;
      queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', payload.chatId], (old) =>
        removeMessageFromPages<InfiniteData<MessagePage>, Message>(old, payload.messageId),
      );
      void deleteCachedMessage(payload.chatId, payload.messageId).catch(() => undefined);
    };
    socket.on('message:new', onCacheNewMessage);
    socket.on('message:updated', onCacheUpdatedMessage);
    socket.on('message:deleted', onCacheDeletedMessage);

    return () => {
      socket.off('message:new', onCacheNewMessage);
      socket.off('message:updated', onCacheUpdatedMessage);
      socket.off('message:deleted', onCacheDeletedMessage);
    };
  }, [chatId]);
}
