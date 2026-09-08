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

interface MessageAttachmentPayload {
  mediaId: string;
  fileNameSnapshot: string | null;
  fileSizeSnapshot: number | null;
  mimeSnapshot: string | null;
  category: string;
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

function createAttachmentPayload(file: FileAttachment): MessageAttachmentPayload {
  return {
    mediaId: file.fileId,
    fileNameSnapshot: file.fileName,
    fileSizeSnapshot: file.fileSize,
    mimeSnapshot: file.fileMime,
    category: file.fileCategory,
  };
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
          contentUrl: '',
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
    attachments: file
      ? [
          {
            id: `client:${input.clientId}:attachment`,
            messageId: `client:${input.clientId}`,
            mediaId: file.fileId,
            fileNameSnapshot: file.fileName,
            fileSizeSnapshot: file.fileSize,
            mimeSnapshot: file.fileMime,
            category: file.fileCategory as MessageMediaCategory,
            createdAt: now,
          },
        ]
      : [],
    forwardContext: null,
    localStatus: 'sending',
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

export function removeOptimisticMessage(chatId: string, clientId: string) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) => {
    if (!old) return old;

    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        messages: page.messages.filter((message) => message.clientId !== clientId),
      })),
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
      setMessageText((prev) => {
        const resolved = typeof value === 'function' ? value(prev) : value;

        if (!chatIdRef.current) return resolved;

        if (!isTypingRef.current && resolved.trim()) {
          isTypingRef.current = true;
          socket.emit('typing:start', { chatId: chatIdRef.current });
        }

        debouncedStopTyping();
        return resolved;
      });
    },
    [debouncedStopTyping],
  );

  const setFileAttachment = useCallback((file: FileAttachment | null) => {
    pendingFileRef.current = file;
  }, []);

  const handleSend = useCallback(async () => {
    const chatId = chatIdRef.current;
    if (!chatId || !senderId) return;

    const file = pendingFileRef.current;

    if (file) {
      const clientId = crypto.randomUUID();
      const attachment = createAttachmentPayload(file);
      const optimistic = createOptimisticMessage({
        clientId,
        chatId,
        senderId,
        text: null,
        file,
      });

      pendingFileRef.current = null;
      setMessageText('');
      await queryClient.cancelQueries({ queryKey: ['messages', chatId] });
      const snapshot = queryClient.getQueryData<InfiniteData<MessagePage>>(['messages', chatId]);
      insertOptimisticMessage(chatId, optimistic);
      frontendLog('debug', 'SendMessage', 'message_send_requested', {
        hasChatId: !!chatId,
        hasClientId: !!clientId,
        hasFile: true,
        hasText: false,
        type: getMessageTypeFromCategory(file.fileCategory),
      });
      try {
        socket.emit('message:send', {
          chatId,
          clientId,
          type: getMessageTypeFromCategory(file.fileCategory),
          attachments: [attachment],
        });
      } catch {
        if (snapshot) queryClient.setQueryData(['messages', chatId], snapshot);
        frontendLog('warn', 'SendMessage', 'message_send_failed', {
          hasChatId: !!chatId,
          hasClientId: !!clientId,
        });
        throw new Error('Socket send failed');
      }
      stopTyping();
      return;
    }

    const trimmed = messageText.trim();
    if (!trimmed) return;
    const clientId = crypto.randomUUID();
    const optimistic = createOptimisticMessage({
      clientId,
      chatId,
      senderId,
      text: trimmed,
    });

    setMessageText('');
    await queryClient.cancelQueries({ queryKey: ['messages', chatId] });
    const snapshot = queryClient.getQueryData<InfiniteData<MessagePage>>(['messages', chatId]);
    insertOptimisticMessage(chatId, optimistic);
    frontendLog('debug', 'SendMessage', 'message_send_requested', {
      hasChatId: !!chatId,
      hasClientId: !!clientId,
      hasFile: false,
      hasText: true,
      type: 'TEXT',
    });
    try {
      socket.emit('message:send', { chatId, text: trimmed, clientId });
    } catch {
      if (snapshot) queryClient.setQueryData(['messages', chatId], snapshot);
      frontendLog('warn', 'SendMessage', 'message_send_failed', {
        hasChatId: !!chatId,
        hasClientId: !!clientId,
      });
      throw new Error('Socket send failed');
    }
    stopTyping();
  }, [messageText, senderId, stopTyping]);

  return {
    messageText,
    setMessageText: handleChange,
    handleSend,
    setFileAttachment,
  };
}
