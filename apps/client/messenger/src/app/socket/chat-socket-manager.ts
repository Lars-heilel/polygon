import type { Chat } from '@org/entities-chat';
import { useChatStore } from '@org/entities-chat';
import { usePresenceStore } from '@org/entities-chat';
import type { Message, MessagePage } from '@org/entities-message';
import { frontendLog, queryClient, socket } from '@org/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { unstable_batchedUpdates } from 'react-dom';
import {
  markMessageSendError,
  removeMessageFromPages,
  upsertMessageIntoPages,
  updateChatListLastMessage,
  updateMessageInPages,
} from './chat-cache-updaters';

function handleNewMessage(msg: Message) {
  frontendLog('debug', 'ChatSocket', 'message_received', {
    hasChatId: !!msg.chatId,
    hasMessageId: !!msg.id,
    type: msg.type,
  });

  const chatStore = useChatStore.getState();
  const tabVisible = document.visibilityState === 'visible' && document.hasFocus();

  unstable_batchedUpdates(() => {
    queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', msg.chatId], (old) =>
      upsertMessageIntoPages(old, msg),
    );

    queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
      updateChatListLastMessage(old, msg),
    );

    if (hasMessageMedia(msg)) {
      queryClient.invalidateQueries({ queryKey: ['chat-media-messages', msg.chatId] });
    }

    if (msg.chatId !== chatStore.activeChatId || !tabVisible) {
      chatStore.incrementUnread(msg.chatId);
    }

    chatStore.setLastReceivedMessage(msg);
  });
}

function handleMessageSendError(payload: { chatId: string; clientId: string }) {
  frontendLog('warn', 'ChatSocket', 'message_send_failed', {
    hasChatId: !!payload.chatId,
    hasClientId: !!payload.clientId,
  });

  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', payload.chatId], (old) =>
    markMessageSendError(old, payload.clientId),
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
