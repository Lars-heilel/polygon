import type { Chat } from '@org/entities-chat';
import { useChatStore } from '@org/entities-chat';
import { usePresenceStore } from '@org/entities-chat';
import type { Message, MessagePage } from '@org/entities-message';
import { frontendLog, queryClient, socket } from '@org/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { unstable_batchedUpdates } from 'react-dom';
import { appendMessageToPages, updateChatListLastMessage } from './chat-cache-updaters';

function handleNewMessage(msg: Message) {
  frontendLog('debug', 'ChatSocket', 'message_received', {
    hasChatId: !!msg.chatId,
    hasMessageId: !!msg.id,
    type: msg.type,
  });

  unstable_batchedUpdates(() => {
    queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', msg.chatId], (old) =>
      appendMessageToPages(old, msg),
    );

    queryClient.setQueryData<Chat[]>(['chats'], (old = []) =>
      updateChatListLastMessage(old, msg),
    );
  });

  useChatStore.getState().setLastReceivedMessage(msg);
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

  return () => {
    socket.off('message:new', handleNewMessage);
    socket.off('user:online', handleUserOnline);
    socket.off('user:offline', handleUserOffline);
    socket.off('user:typing', handleUserTyping);
  };
}
