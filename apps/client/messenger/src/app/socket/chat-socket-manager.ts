import type { Chat } from '@org/entities-chat';
import { chatApi, useChatStore } from '@org/entities-chat';
import { usePresenceStore } from '@org/entities-chat';
import type { Message, MessagePage } from '@org/entities-message';
import { frontendLog, queryClient, socket } from '@org/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { unstable_batchedUpdates } from 'react-dom';
import {
  markMessageSendError,
  removeMessageFromPages,
  updateChatListUnreadCount,
  upsertMessageIntoPages,
  updateChatListLastMessage,
  updateMessageInPages,
} from './chat-cache-updaters';

function getCurrentUserId(): string | null {
  // Same source as use-message-notification — no new session plumbing.
  return queryClient.getQueryData<{ id: string }>(['me'])?.id ?? null;
}

function handleNewMessage(msg: Message) {
  frontendLog('debug', 'ChatSocket', 'message_received', {
    hasChatId: !!msg.chatId,
    hasMessageId: !!msg.id,
    type: msg.type,
  });

  const chatStore = useChatStore.getState();
  const currentUserId = getCurrentUserId();
  const isOwn = currentUserId !== null && msg.senderId === currentUserId;
  const isActiveChat = msg.chatId === chatStore.activeChatId;
  const tabVisible = document.visibilityState === 'visible' && document.hasFocus();

  unstable_batchedUpdates(() => {
    queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', msg.chatId], (old) =>
      upsertMessageIntoPages(old, msg),
    );
    queryClient.invalidateQueries({ queryKey: ['messages-flat', msg.chatId] });

    // Guarded inside: only moves the preview forward, never back.
    queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
      updateChatListLastMessage(old, msg),
    );

    if (hasMessageMedia(msg)) {
      queryClient.invalidateQueries({ queryKey: ['chat-media-messages', msg.chatId] });
    }

    if (isOwn) {
      // Own messages (incl. socket echo) never affect unread.
    } else if (!isActiveChat || !tabVisible) {
      // Single-source unread: bump the server-derived counter only.
      queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
        updateChatListUnreadCount(old, msg.chatId, 1),
      );
    } else {
      // Foreign message arrived while the user is looking at the chat —
      // clear it on the server right away (fire-and-forget) and mirror the zero.
      void chatApi.markRead(msg.chatId).catch(() => undefined);
      queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
        old.map((chat) => (chat.id === msg.chatId ? { ...chat, unreadCount: 0 } : chat)),
      );
    }

    chatStore.setLastReceivedMessage(msg);
  });
}

interface MessageSendErrorPayload {
  chatId: string;
  clientId: string | null;
  code?: string;
  message?: string;
}

function handleMessageSendError(payload: MessageSendErrorPayload) {
  frontendLog('warn', 'ChatSocket', 'message_send_failed', {
    hasChatId: !!payload.chatId,
    hasClientId: !!payload.clientId,
    code: payload.code ?? 'UNKNOWN',
  });

  const { clientId } = payload;
  if (!clientId) return;

  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', payload.chatId], (old) =>
    markMessageSendError(old, clientId),
  );
}

function handleMessageUpdated(msg: Message) {
  frontendLog('debug', 'ChatSocket', 'message_updated', {
    hasChatId: !!msg.chatId,
    hasMessageId: !!msg.id,
    type: msg.type,
  });

  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', msg.chatId], (old) =>
    updateMessageInPages(old, msg),
  );
  queryClient.invalidateQueries({ queryKey: ['messages-flat', msg.chatId] });

  // Keep the list preview in sync when the edited message is the preview.
  const chats = queryClient.getQueryData<Chat[]>(['chats']);
  const target = chats?.find((chat) => chat.id === msg.chatId);
  if (target?.lastMessage && target.lastMessage.id === msg.id) {
    queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
      updateChatListLastMessage(old, msg),
    );
  }
}

function handleMessageRemoved(payload: { chatId: string; messageId: string }) {
  frontendLog('debug', 'ChatSocket', 'message_removed', {
    hasChatId: !!payload.chatId,
    hasMessageId: !!payload.messageId,
  });

  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', payload.chatId], (old) =>
    removeMessageFromPages(old, payload.messageId),
  );
  queryClient.invalidateQueries({ queryKey: ['chat-media-messages', payload.chatId] });
  queryClient.invalidateQueries({ queryKey: ['messages-flat', payload.chatId] });

  // If the removed message was the list preview, clear it locally and let the
  // server refetch recompute the true tail (GET messages take:1 equivalent).
  const chats = queryClient.getQueryData<Chat[]>(['chats']);
  const target = chats?.find((chat) => chat.id === payload.chatId);
  if (target?.lastMessage && target.lastMessage.id === payload.messageId) {
    queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
      old.map((chat) => (chat.id === payload.chatId ? { ...chat, lastMessage: null } : chat)),
    );
    queryClient.invalidateQueries({ queryKey: ['chats'] });
    queryClient.invalidateQueries({ queryKey: ['messages', payload.chatId] });
  }
}

function handleUserOnline(payload: { userId: string; chatId: string }) {
  usePresenceStore.getState().setOnline(payload.userId);
}

function handleUserOffline(payload: { userId: string; chatId: string }) {
  usePresenceStore.getState().setOffline(payload.userId);
}

function handleUserTyping(payload: { userId: string; chatId: string; isTyping: boolean }) {
  useChatStore.getState().setIsTyping(payload.userId, payload.isTyping);
}

export function initChatSocketManager(): () => void {
  frontendLog('debug', 'ChatSocket', 'chat_socket_manager_started');
  socket.on('message:new', handleNewMessage);
  socket.on('user:online', handleUserOnline);
  socket.on('user:offline', handleUserOffline);
  socket.on('user:typing', handleUserTyping);
  socket.on('message:send:error', handleMessageSendError);
  socket.on('message:updated', handleMessageUpdated);
  socket.on('message:deleted', handleMessageRemoved);
  socket.on('message:hidden', handleMessageRemoved);

  return () => {
    socket.off('message:new', handleNewMessage);
    socket.off('user:online', handleUserOnline);
    socket.off('user:offline', handleUserOffline);
    socket.off('user:typing', handleUserTyping);
    socket.off('message:send:error', handleMessageSendError);
    socket.off('message:updated', handleMessageUpdated);
    socket.off('message:deleted', handleMessageRemoved);
    socket.off('message:hidden', handleMessageRemoved);
  };
}

function hasMessageMedia(msg: Message): boolean {
  return Boolean(msg.media) || (Array.isArray(msg.attachments) && msg.attachments.length > 0);
}
