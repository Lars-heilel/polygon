import { useState } from 'react';

import { socket } from '@org/shared';

export function useSendMessage(chatId: string | null) {
  const [messageText, setMessageText] = useState('');

  const handleSend = () => {
    const trimmed = messageText.trim();
    if (!trimmed || !chatId) return;
    setMessageText('');
    socket.emit('message:send', { chatId, text: trimmed });
  };

  return {
    messageText,
    setMessageText,
    handleSend,
  };
}
