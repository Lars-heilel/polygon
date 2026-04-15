import { useState } from 'react';

import { useGetMessagesQuery, useMeQuery } from '@org/entities';
import { socket } from '@org/shared';

export function useChatWindow(chatId: string | null) {
  const { data: messages, isLoading } = useGetMessagesQuery(chatId ?? '');
  const { data: me } = useMeQuery();
  const [messageText, setMessageText] = useState('');

  const handleSend = () => {
    const trimmed = messageText.trim();
    if (!trimmed || !chatId) return;

    setMessageText('');
    socket.emit('message:send', { chatId, text: trimmed });
  };

  return {
    messages: messages ?? [],
    isLoading,
    currentUserId: me?.id ?? '',
    messageText,
    setMessageText,
    handleSend,
  };
}
