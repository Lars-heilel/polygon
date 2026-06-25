import { useCallback, useEffect, useRef, useState } from 'react';

import { socket } from '@org/shared';
import { debounce } from 'es-toolkit';

export interface FileAttachment {
  fileId: string;
  fileBucket: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileMime: string;
}

export function useSendMessage(chatId: string | null) {
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
    if (!chatIdRef.current) return;

    const file = pendingFileRef.current;

    if (file) {
      pendingFileRef.current = null;
      setMessageText('');
      socket.emit('message:send', {
        chatId: chatIdRef.current,
        type: file.fileMime.startsWith('image/') ? 'IMAGE' : 'FILE',
        fileId: file.fileId,
        fileBucket: file.fileBucket,
        fileKey: file.fileKey,
        fileName: file.fileName,
        fileSize: file.fileSize,
        fileMime: file.fileMime,
      });
      stopTyping();
      return;
    }

    const trimmed = messageText.trim();
    if (!trimmed) return;
    setMessageText('');
    socket.emit('message:send', { chatId: chatIdRef.current, text: trimmed });
    stopTyping();
  }, [messageText, stopTyping]);

  return {
    messageText,
    setMessageText: handleChange,
    handleSend,
    setFileAttachment,
  };
}
