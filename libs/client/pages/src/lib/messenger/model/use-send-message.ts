import { useCallback, useState } from 'react';

import { useSendMessageMutation } from '@org/entities';
import { toast } from '@org/shared';

export function useSendMessage(chatId: string) {
  const [text, setText] = useState('');
  const { mutate, isPending } = useSendMessageMutation(chatId);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    setText('');
    mutate(trimmed, {
      onError: () => {
        toast.error('Failed to send message');
        setText(trimmed);
      },
    });
  }, [text, isPending, mutate]);

  return {
    text,
    setText,
    send,
    isSending: isPending,
  };
}
