import { useEffect, useRef } from 'react';

import { queryClient, toast } from '@org/shared';
import { useChatStore } from '@org/entities';
import type { Chat } from '@org/entities';

import { useNotificationStore } from './notification.store';

function playNotificationSound() {
  const audio = new Audio('/sounds/pda_4LbLWWH.mp3');
  audio.volume = 0.6;
  audio.play().catch(() => {});
}

function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

export function useMessageNotification() {
  const isMuted = useNotificationStore((s) => s.isMuted);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  useEffect(() => {
    return useChatStore.subscribe(
      (state) => state.lastReceivedMessage,
      (msg) => {
        if (!msg) return;

        const activeChatId = useChatStore.getState().activeChatId;
        if (msg.chatId === activeChatId) return;

        if (isMutedRef.current) return;

        playNotificationSound();

        if (isMobile()) return;

        const chats = queryClient.getQueryData<Chat[]>(['chats']) ?? [];
        const chat = chats.find((c) => c.id === msg.chatId);
        const sender = chat?.members.find((m) => m.userId === msg.senderId)?.profile;
        const senderName = sender?.displayName ?? sender?.name ?? 'New message';
        const preview = msg.text ? (msg.text.length > 60 ? msg.text.slice(0, 60) + '…' : msg.text) : '📎';

        toast(senderName, {
          description: preview,
          duration: 4000,
        });
      },
    );
  }, []);
}
