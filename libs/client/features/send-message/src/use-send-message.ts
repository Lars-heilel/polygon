import { useCallback, useEffect, useRef, useState } from 'react';

import { socket } from '@org/shared';
import { debounce } from 'es-toolkit';

export function useSendMessage(chatId: string | null) {
  const [messageText, setMessageText] = useState('');
  const isTypingRef = useRef(false);

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

  const handleSend = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed || !chatIdRef.current) return;
    setMessageText('');
    socket.emit('message:send', { chatId: chatIdRef.current, text: trimmed });
    stopTyping();
  }, [messageText, stopTyping]);

  return {
    messageText,
    setMessageText: handleChange,
    handleSend,
  };
}
