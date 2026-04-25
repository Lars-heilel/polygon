import { useCallback, useEffect, useState } from 'react';

import { useInView } from 'react-intersection-observer';

interface UseInfiniteScrollListOptions {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

export function useInfiniteScrollList({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
}: UseInfiniteScrollListOptions) {
  const [scrollEl, setScrollEl] = useState<Element | null>(null);
  const scrollRef = useCallback((node: HTMLDivElement | null) => setScrollEl(node), []);
  const { ref: newestSentinelRef, inView: isAtNewest } = useInView({
    root: scrollEl,
    threshold: 0,
  });

  const { ref: olderSentinelRef, inView: shouldLoadMore } = useInView({
    root: scrollEl,
    threshold: 0,
  });

  useEffect(() => {
    if (shouldLoadMore && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [shouldLoadMore, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!scrollEl) return;
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }, [scrollEl]);

  const scrollToNewest = () => {
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  };

  return {
    scrollRef,
    newestSentinelRef,
    olderSentinelRef,
    isAtNewest,
    scrollToNewest,
  };
}
