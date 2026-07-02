import { useEffect, useRef } from 'react';

import { selectLastReceivedMessage, useChatStore, useGetChatsQuery } from '@org/entities-chat';
import type { Chat } from '@org/entities-chat';
import { queryClient, socket, toast } from '@org/shared';

import { useNotificationStore } from './notification.store';

let notificationAudio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!notificationAudio) {
    notificationAudio = new Audio('/sounds/pda_4LbLWWH.mp3');
    notificationAudio.volume = 0.6;
  }
  return notificationAudio;
}

function playNotificationSound() {
  const audio = getAudio();
  audio.currentTime = 0;
  audio.play().catch((_err: unknown) => {
    void _err;
  });
}

function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

export function useMessageNotification() {
  const isMuted = useNotificationStore((s) => s.isMuted);
  const lastMsg = useChatStore(selectLastReceivedMessage);
  const processedIdRef = useRef<string | null>(null);
  const { data: chats } = useGetChatsQuery();
  const activeChatId = useChatStore((s) => s.activeChatId);

  useEffect(() => {
    const unlock = () => {
      const audio = getAudio();
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch((_err: unknown) => {
          void _err;
        });
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (!chats?.length) return;
    console.log('[MessageNotify] Joining rooms for', chats.length, 'chats');
    chats.forEach((chat) => socket.emit('chat:join', { chatId: chat.id }));
  }, [chats, activeChatId]);

  useEffect(() => {
    if (!lastMsg || lastMsg.id === processedIdRef.current) return;
    processedIdRef.current = lastMsg.id;

    const currentActiveChatId = useChatStore.getState().activeChatId;
    const tabVisible = document.visibilityState === 'visible' && document.hasFocus();

    console.log('[MessageNotify] Received message id=' + lastMsg.id + ', chatId=' + lastMsg.chatId, {
      activeChatId: currentActiveChatId,
      tabVisible,
      isMuted,
      isMobile: isMobile(),
      senderId: lastMsg.senderId,
    });

    if (lastMsg.chatId === currentActiveChatId && tabVisible) {
      console.log('[MessageNotify] Suppressed: user is in active chat with tab focused');
      return;
    }

    const me = queryClient.getQueryData<{ id: string }>(['me']);
    if (lastMsg.senderId === me?.id) {
      console.log('[MessageNotify] Suppressed: message from self');
      return;
    }

    if (isMuted) {
      console.log('[MessageNotify] Suppressed: notifications are muted');
      return;
    }

    console.log('[MessageNotify] Playing notification sound');
    playNotificationSound();

    if (isMobile()) {
      console.log('[MessageNotify] Suppressed toast: is mobile (no in-app toast on phone)');
      return;
    }

    const allChats = queryClient.getQueryData<Chat[]>(['chats']) ?? [];
    const chat = allChats.find((c) => c.id === lastMsg.chatId);
    const sender = chat?.members.find((m) => m.userId === lastMsg.senderId)?.profile;
    const senderName = sender?.displayName ?? sender?.name ?? 'New message';
    const preview = lastMsg.text
      ? lastMsg.text.length > 60
        ? lastMsg.text.slice(0, 60) + '…'
        : lastMsg.text
      : '📎';

    console.log('[MessageNotify] Showing toast from', senderName);
    toast(senderName, { description: preview, duration: 4000 });
  }, [lastMsg, isMuted]);
}
