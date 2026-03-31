import { useState } from 'react';

import { useGetMessagesQuery, useMeQuery, useSendMessageMutation } from '@org/entities';

export function useChatWindow(chatId: string | null) {
  // const isEnabled = Boolean(chatId);
  const { data: messages, isLoading } = useGetMessagesQuery(chatId ?? '');
  const { data: me } = useMeQuery();
  const [messageText, setMessageText] = useState('');

  const sendMessageMutation = useSendMessageMutation(chatId ?? '');

  const handleSend = () => {
    const trimmed = messageText.trim();
    if (!trimmed || !chatId) return;

    sendMessageMutation.mutate(trimmed, {
      onError: () => {
        setMessageText(trimmed);
      },
    });
  };

  return {
    messages: messages ?? [],
    isLoading,
    currentUserId: me?.id ?? '',
    messageText,
    setMessageText,
    isSending: sendMessageMutation.isPending,
    handleSend,
  };
}
