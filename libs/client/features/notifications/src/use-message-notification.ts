import { useEffect, useRef } from 'react';

import { debounce } from 'es-toolkit';

import {
  getMessagePreview,
  selectLastReceivedMessage,
  useChatStore,
  useGetChatsQuery,
} from '@org/entities-chat';
import type { Chat } from '@org/entities-chat';
import { queryClient, socket, toast, useLogger } from '@org/shared';

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
  const logger = useLogger('MessageNotify');
  const isMuted = useNotificationStore((s) => s.isMuted);
  const lastMsg = useChatStore(selectLastReceivedMessage);
  const processedIdRef = useRef<string | null>(null);
  const joinedRef = useRef<Set<string>>(new Set());
  const { data: chats } = useGetChatsQuery();

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
    const joinDiff = debounce(() => {
      const ids = new Set((chats ?? []).map((chat) => chat.id));
      logger.debug('Joining chat notification rooms', { chatCount: ids.size });
      for (const id of ids) {
        if (!joinedRef.current.has(id)) {
          socket.emit('chat:join', { chatId: id });
          joinedRef.current.add(id);
        }
      }
      for (const id of Array.from(joinedRef.current)) {
        if (!ids.has(id)) {
          socket.emit('chat:leave', { chatId: id });
          joinedRef.current.delete(id);
        }
      }
    }, 500);
    joinDiff();
    return () => {
      joinDiff.cancel();
    };
  }, [chats, logger]);

  useEffect(() => {
    if (!lastMsg || lastMsg.id === processedIdRef.current) return;
    processedIdRef.current = lastMsg.id;

    const currentActiveChatId = useChatStore.getState().activeChatId;
    const tabVisible = document.visibilityState === 'visible' && document.hasFocus();

    logger.debug('Received message notification candidate', {
      hasMessageId: !!lastMsg.id,
      hasChatId: !!lastMsg.chatId,
      hasActiveChatId: !!currentActiveChatId,
      tabVisible,
      isMuted,
      isMobile: isMobile(),
      hasSenderId: !!lastMsg.senderId,
    });

    if (lastMsg.chatId === currentActiveChatId && tabVisible) {
      logger.debug('Suppressed notification because active chat has focus');
      return;
    }

    const me = queryClient.getQueryData<{ id: string }>(['me']);
    if (lastMsg.senderId === me?.id) {
      logger.debug('Suppressed notification because message belongs to current user');
      return;
    }

    if (isMuted) {
      logger.debug('Suppressed notification because notifications are muted');
      return;
    }

    logger.debug('Playing notification sound');
    playNotificationSound();

    if (isMobile()) {
      logger.debug('Suppressed toast on mobile viewport');
      return;
    }

    const allChats = queryClient.getQueryData<Chat[]>(['chats']) ?? [];
    const chat = allChats.find((c) => c.id === lastMsg.chatId);
    const sender = chat?.members.find((m) => m.userId === lastMsg.senderId)?.profile;
    const senderName = sender?.displayName ?? sender?.name ?? 'New message';
    const preview = getMessagePreview(lastMsg);

    logger.debug('Showing message notification toast', { hasSenderName: !!senderName });
    toast(senderName, { description: preview, duration: 4000 });
  }, [lastMsg, isMuted, logger]);
}
