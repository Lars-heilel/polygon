import { useCallback, useEffect, useRef, useState } from 'react';

import type { InfiniteData } from '@tanstack/react-query';
import type { Message, MessageMediaCategory, MessagePage } from '@org/entities-message';
import { frontendLog, queryClient, socket } from '@org/shared';
import { debounce } from 'es-toolkit';

export interface FileAttachment {
  fileId: string;
  fileBucket: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileMime: string;
  fileCategory: string;
}

export function getMessageTypeFromCategory(category: string): string {
  switch (category) {
    case 'IMAGE': return 'IMAGE';
    case 'AUDIO': return 'AUDIO';
    case 'VIDEO': return 'VIDEO';
    case 'VOICE': return 'VOICE';
    case 'CIRCLE': return 'VIDEO';
    default: return 'FILE';
  }
}

function getKindFromCategory(category: string): Message['kind'] {
  switch (category) {
    case 'IMAGE':
      return 'image';
    case 'VIDEO':
      return 'video';
    case 'CIRCLE':
      return 'circle';
    case 'AUDIO':
      return 'audio';
    case 'VOICE':
      return 'voice';
    default:
      return 'file';
  }
}

function createOptimisticMessage(input: {
  clientId: string;
  chatId: string;
  senderId: string;
  text: string | null;
  file?: FileAttachment | null;
}): Message {
  const now = new Date().toISOString();
  const file = input.file ?? null;

  return {
    id: `client:${input.clientId}`,
    clientId: input.clientId,
    chatId: input.chatId,
    senderId: input.senderId,
    kind: file ? getKindFromCategory(file.fileCategory) : 'text',
    type: file ? getMessageTypeFromCategory(file.fileCategory) : 'TEXT',
    text: input.text,
    createdAt: now,
    updatedAt: now,
    media: file
      ? {
          fileId: file.fileId,
          contentUrl: `/api/media/files/${file.fileId}/content`,
          thumbUrl: null,
          fileName: file.fileName,
          mime: file.fileMime,
          size: file.fileSize,
          category: file.fileCategory as MessageMediaCategory,
          width: null,
          height: null,
          durationMs: null,
          waveform: null,
        }
      : null,
    linkPreview: null,
    localStatus: 'sending',
    fileId: file?.fileId ?? null,
    fileBucket: file?.fileBucket ?? null,
    fileKey: file?.fileKey ?? null,
    fileName: file?.fileName ?? null,
    fileSize: file?.fileSize ?? null,
    fileMime: file?.fileMime ?? null,
    fileCategory: file?.fileCategory ?? null,
    forwardedFromId: null,
    editedAt: null,
    deletedAt: null,
    deletedById: null,
  };
}

function insertOptimisticMessage(chatId: string, message: Message) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) => {
    if (!old) return old;

    return {
      ...old,
      pages: old.pages.map((page, index) =>
        index === 0 ? { ...page, messages: [...page.messages, message] } : page,
      ),
    };
  });
}

export function useSendMessage(chatId: string | null, senderId: string | null = null) {
  const [messageText, setMessageText] = useState('');
  const isTypingRef = useRef(false);
  const pendingFileRef = useRef<FileAttachment | null>(null);

  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  const stopTyping = useCallback(() => {
    if (!isTypingRef.current || !chatIdRef.current) return;
    isTypingRef.current = false;
    socket.emit('typing:stop', { chatId: chatIdRef.current });
  }, []);

  const debouncedStopTyping = useRef(debounce(() => stopTyping(), 2000)).current;

  useEffect(() => {
    return () => {
      stopTyping();
      debouncedStopTyping.cancel();
    };
  }, [stopTyping, debouncedStopTyping]);

  const handleChange = useCallback(
    (value: string | ((prev: string) => string)) => {
      const resolved = typeof value === 'function' ? value(messageText) : value;
      setMessageText(resolved);

      if (!chatIdRef.current) return;

      if (!isTypingRef.current && resolved.trim()) {
        isTypingRef.current = true;
        socket.emit('typing:start', { chatId: chatIdRef.current });
      }

      debouncedStopTyping();
    },
    [debouncedStopTyping, messageText],
  );

  const setFileAttachment = useCallback((file: FileAttachment | null) => {
    pendingFileRef.current = file;
  }, []);

  const handleSend = useCallback(() => {
    if (!chatIdRef.current || !senderId) return;

    const file = pendingFileRef.current;

    if (file) {
      const clientId = crypto.randomUUID();
      const optimistic = createOptimisticMessage({
        clientId,
        chatId: chatIdRef.current,
        senderId,
        text: null,
        file,
      });

      pendingFileRef.current = null;
      setMessageText('');
      insertOptimisticMessage(chatIdRef.current, optimistic);
      frontendLog('debug', 'SendMessage', 'message_send_requested', {
        hasChatId: !!chatIdRef.current,
        hasClientId: !!clientId,
        hasFile: true,
        hasText: false,
        type: getMessageTypeFromCategory(file.fileCategory),
      });
      socket.emit('message:send', {
        chatId: chatIdRef.current,
        clientId,
        type: getMessageTypeFromCategory(file.fileCategory),
        fileId: file.fileId,
        fileBucket: file.fileBucket,
        fileKey: file.fileKey,
        fileName: file.fileName,
        fileSize: file.fileSize,
        fileMime: file.fileMime,
        fileCategory: file.fileCategory,
      });
      stopTyping();
      return;
    }

    const trimmed = messageText.trim();
    if (!trimmed) return;
    const clientId = crypto.randomUUID();
    const optimistic = createOptimisticMessage({
      clientId,
      chatId: chatIdRef.current,
      senderId,
      text: trimmed,
    });

    setMessageText('');
    insertOptimisticMessage(chatIdRef.current, optimistic);
    frontendLog('debug', 'SendMessage', 'message_send_requested', {
      hasChatId: !!chatIdRef.current,
      hasClientId: !!clientId,
      hasFile: false,
      hasText: true,
      type: 'TEXT',
    });
    socket.emit('message:send', { chatId: chatIdRef.current, text: trimmed, clientId });
    stopTyping();
  }, [messageText, senderId, stopTyping]);

  return {
    messageText,
    setMessageText: handleChange,
    handleSend,
    setFileAttachment,
  };
}
