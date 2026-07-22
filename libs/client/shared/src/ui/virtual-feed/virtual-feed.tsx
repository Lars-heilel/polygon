import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

import { frontendLog } from '../../lib/hooks/use-logger';
import { cn } from '../../lib/utils/cn';

export interface VirtualFeedHandle {
  scrollToEnd: (behavior?: 'auto' | 'smooth') => void;
}

export interface VirtualFeedProps<TItem> {
  items: TItem[];
  mode: 'reverse' | 'forward';
  getKey: (item: TItem) => string;
  renderItem: (item: TItem, index: number) => ReactNode;
  loadPrevious?: () => void;
  loadNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  isLoadingPrevious?: boolean;
  isLoadingNext?: boolean;
  empty?: ReactNode;
  footer?: ReactNode;
  floatingAction?: ReactNode;
  estimateItemHeight?: number;
  baseIndex?: number;
  className?: string;
  atBottomThreshold?: number;
  onAtBottomChange?: (isAtBottom: boolean) => void;
  diagnosticName?: string;
}

const DEFAULT_BASE_INDEX = 10_000;

function canLogVirtualFeedDiagnostics(): boolean {
  if (import.meta.env.PROD) return false;
  try {
    return globalThis.localStorage?.getItem('polygon.debug.virtualFeed') === '1';
  } catch {
    return false;
  }
}

function getScrollerSnapshot(root: HTMLDivElement | null) {
  const scroller = root?.querySelector<HTMLElement>('[data-virtuoso-scroller]');
  if (!scroller) return null;

  const distanceFromBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;

  return {
    scrollTop: Math.round(scroller.scrollTop),
    scrollHeight: Math.round(scroller.scrollHeight),
    clientHeight: Math.round(scroller.clientHeight),
    distanceFromBottom: Math.round(distanceFromBottom),
  };
}

function VirtualFeedInner<TItem>(
  {
    items,
    mode,
    getKey,
    renderItem,
    loadPrevious,
    loadNext,
    hasPrevious,
    hasNext,
    isLoadingPrevious,
    isLoadingNext,
    empty,
    footer,
    floatingAction,
    estimateItemHeight = 80,
    baseIndex = DEFAULT_BASE_INDEX,
    className,
    atBottomThreshold = 24,
    onAtBottomChange,
    diagnosticName,
  }: VirtualFeedProps<TItem>,
  ref: React.ForwardedRef<VirtualFeedHandle>,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const firstItemIndex = mode === 'reverse' ? Math.max(0, baseIndex - items.length) : 0;
  const firstKey = items[0] ? getKey(items[0]) : '';
  const lastKey = items.at(-1) ? getKey(items.at(-1) as TItem) : '';
  const diagnosticsRef = useRef({
    itemCount: items.length,
    firstItemIndex,
    firstKey,
    lastKey,
    atBottom: false,
  });

  useImperativeHandle(ref, () => ({
    scrollToEnd: (behavior = 'smooth') => {
      if (canLogVirtualFeedDiagnostics()) {
        frontendLog('debug', 'VirtualFeed', 'scroll_to_end_requested', {
          name: diagnosticName ?? 'virtual-feed',
          behavior,
          itemCount: items.length,
          scroll: getScrollerSnapshot(rootRef.current),
        });
      }
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior });
    },
  }), [diagnosticName, items.length]);

  useEffect(() => {
    if (!canLogVirtualFeedDiagnostics()) {
      diagnosticsRef.current = {
        itemCount: items.length,
        firstItemIndex,
        firstKey,
        lastKey,
        atBottom: diagnosticsRef.current.atBottom,
      };
      return;
    }

    const previous = diagnosticsRef.current;
    diagnosticsRef.current = {
      itemCount: items.length,
      firstItemIndex,
      firstKey,
      lastKey,
      atBottom: previous.atBottom,
    };

    const frame = window.requestAnimationFrame(() => {
      frontendLog('debug', 'VirtualFeed', 'items_committed', {
        name: diagnosticName ?? 'virtual-feed',
        mode,
        itemCount: items.length,
        itemCountDelta: items.length - previous.itemCount,
        firstItemIndex,
        firstItemIndexDelta: firstItemIndex - previous.firstItemIndex,
        firstKeyChanged: firstKey !== previous.firstKey,
        lastKeyChanged: lastKey !== previous.lastKey,
        atBottom: previous.atBottom,
        scroll: getScrollerSnapshot(rootRef.current),
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [diagnosticName, firstItemIndex, firstKey, items.length, lastKey, mode]);

  const components = useMemo(
    () => ({
      Footer: () => <>{footer}</>,
    }),
    [footer],
  );

  if (items.length === 0 && empty) {
    return (
      <div
        ref={rootRef}
        data-testid="virtual-feed"
        data-mode={mode}
        data-first-item-index={firstItemIndex}
        data-item-count={items.length}
        data-first-key={firstKey}
        data-last-key={lastKey}
        className={cn('relative h-full min-h-0 w-full', className)}
      >
        {empty}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-testid="virtual-feed"
      data-mode={mode}
      data-first-item-index={firstItemIndex}
      data-item-count={items.length}
      data-first-key={firstKey}
      data-last-key={lastKey}
      className={cn('relative h-full min-h-0 w-full', className)}
    >
      <Virtuoso
        ref={virtuosoRef}
        className="h-full"
        data={items}
        computeItemKey={(_, item) => getKey(item)}
        firstItemIndex={firstItemIndex}
        defaultItemHeight={estimateItemHeight}
        increaseViewportBy={{ top: 600, bottom: 400 }}
        overscan={200}
        skipAnimationFrameInResizeObserver
        initialTopMostItemIndex={mode === 'reverse' && items.length > 0 ? items.length - 1 : 0}
        atBottomThreshold={atBottomThreshold}
        followOutput={mode === 'reverse' ? (bottom) => (bottom ? 'smooth' : false) : false}
        atBottomStateChange={(isAtBottom) => {
          diagnosticsRef.current.atBottom = isAtBottom;
          if (canLogVirtualFeedDiagnostics()) {
            frontendLog('debug', 'VirtualFeed', 'at_bottom_changed', {
              name: diagnosticName ?? 'virtual-feed',
              atBottom: isAtBottom,
              itemCount: items.length,
              scroll: getScrollerSnapshot(rootRef.current),
            });
          }
          onAtBottomChange?.(isAtBottom);
        }}
        startReached={() => {
          if (canLogVirtualFeedDiagnostics()) {
            frontendLog('debug', 'VirtualFeed', 'start_reached', {
              name: diagnosticName ?? 'virtual-feed',
              mode,
              hasPrevious: !!hasPrevious,
              isLoadingPrevious: !!isLoadingPrevious,
              itemCount: items.length,
              scroll: getScrollerSnapshot(rootRef.current),
            });
          }
          if (mode === 'reverse' && hasPrevious && !isLoadingPrevious) loadPrevious?.();
        }}
        endReached={() => {
          if (canLogVirtualFeedDiagnostics()) {
            frontendLog('debug', 'VirtualFeed', 'end_reached', {
              name: diagnosticName ?? 'virtual-feed',
              mode,
              hasNext: !!hasNext,
              isLoadingNext: !!isLoadingNext,
              itemCount: items.length,
              scroll: getScrollerSnapshot(rootRef.current),
            });
          }
          if (mode === 'forward' && hasNext && !isLoadingNext) loadNext?.();
        }}
        components={components}
        itemContent={(index, item) => renderItem(item, index)}
      />
      {floatingAction}
    </div>
  );
}

export const VirtualFeed = memo(forwardRef(VirtualFeedInner)) as <TItem>(
  props: VirtualFeedProps<TItem> & React.RefAttributes<VirtualFeedHandle>,
) => React.ReactElement;
