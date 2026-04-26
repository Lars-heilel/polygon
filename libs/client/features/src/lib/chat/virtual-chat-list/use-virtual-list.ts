import { useCallback, useLayoutEffect, useRef } from 'react';

import type { Virtualizer } from '@tanstack/react-virtual';

interface UseVirtualChatOptions<TItem extends { id: string | number }> {
  chatId: string;
  messages: TItem[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function useVirtualChat<TItem extends { id: string | number }>({
  chatId,
  messages,
  virtualizer,
  scrollRef,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: UseVirtualChatOptions<TItem>) {
  const isFirstLoad = useRef(true);

  // Сброс состояния при смене чата
  useLayoutEffect(() => {
    isFirstLoad.current = true;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    return;
  }, [chatId, scrollRef]);

  // 1. Первый прыжок вниз при загрузке сообщений
  useLayoutEffect(() => {
    let raf: number;
    if (messages.length > 0 && isFirstLoad.current) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      raf = requestAnimationFrame(() => {
        isFirstLoad.current = false;
      });
      return () => {
        if (raf) cancelAnimationFrame(raf);
      };
    }
    return;
  }, [messages.length, virtualizer, chatId]);

  // 2. Подгрузка истории вверх
  const virtualItems = virtualizer.getVirtualItems();
  const firstItem = virtualItems[0];
  useLayoutEffect(() => {
    if (
      !isFirstLoad.current &&
      firstItem &&
      firstItem.index === 0 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
    return;
  }, [firstItem, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 3. Stick to Bottom при новых сообщениях
  const lastMessageId = messages[messages.length - 1]?.id;
  useLayoutEffect(() => {
    if (isFirstLoad.current || !scrollRef.current || !lastMessageId) {
      return;
    }

    const scrollEl = scrollRef.current;
    const isAtBottom = scrollEl.scrollHeight - scrollEl.scrollTop <= scrollEl.clientHeight + 200;

    if (isAtBottom) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    }
    return;
  }, [lastMessageId, messages.length, virtualizer, scrollRef]);

  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
  }, [messages.length, virtualizer]);

  // Расчет: оторван ли пользователь от низа чата
  const lastVisibleItem = virtualItems.at(-1);
  const isUserUp = (lastVisibleItem?.index ?? 0) < messages.length - 1;

  return {
    isFirstLoad: isFirstLoad.current,
    isUserUp: isUserUp && !isFirstLoad.current,
    scrollToBottom,
  };
}
