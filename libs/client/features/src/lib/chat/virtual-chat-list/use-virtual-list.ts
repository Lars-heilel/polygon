import { useCallback, useLayoutEffect, useRef, useState } from 'react';

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
  const [isReady, setIsReady] = useState(false);
  const isAutoScrolling = useRef(false);
  const prevTotalSize = useRef(0);

  useLayoutEffect(() => {
    setIsReady(false);
    isAutoScrolling.current = false;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [chatId, scrollRef]);

  const totalSize = virtualizer.getTotalSize();

  useLayoutEffect(() => {
    if (messages.length === 0) return;

    if (!isReady || isAutoScrolling.current) {
      virtualizer.scrollToOffset(totalSize, { align: 'end' });

      const raf = requestAnimationFrame(() => {
        if (!isReady) setIsReady(true);
        if (totalSize === prevTotalSize.current) {
          isAutoScrolling.current = false;
        }
      });

      prevTotalSize.current = totalSize;
      return () => cancelAnimationFrame(raf);
    }
  }, [totalSize, messages.length, isReady, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const firstItem = virtualItems[0];
  useLayoutEffect(() => {
    if (isReady && firstItem?.index === 0 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [firstItem?.index, hasNextPage, isFetchingNextPage, fetchNextPage, isReady]);

  useLayoutEffect(() => {
    if (!isReady || !scrollRef.current) return;

    const scrollEl = scrollRef.current;

    const isAtBottom = scrollEl.scrollHeight - scrollEl.scrollTop <= scrollEl.clientHeight + 150;

    if (isAtBottom) {
      isAutoScrolling.current = true;
      virtualizer.scrollToOffset(virtualizer.getTotalSize(), { align: 'end' });
    }
  }, [messages.length, isReady, virtualizer, scrollRef]);

  const scrollToBottom = useCallback(() => {
    isAutoScrolling.current = true;

    virtualizer.scrollToOffset(virtualizer.getTotalSize(), { align: 'end', behavior: 'smooth' });
  }, [virtualizer]);

  const lastVisibleItem = virtualItems.at(-1);
  const isUserUp = isReady && lastVisibleItem && lastVisibleItem.index < messages.length - 1;

  return { isReady, isUserUp, scrollToBottom };
}
