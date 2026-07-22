import {
  forwardRef,
  memo,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

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
}

const DEFAULT_BASE_INDEX = 10_000;

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
  }: VirtualFeedProps<TItem>,
  ref: React.ForwardedRef<VirtualFeedHandle>,
) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const firstItemIndex = mode === 'reverse' ? Math.max(0, baseIndex - items.length) : 0;

  useImperativeHandle(ref, () => ({
    scrollToEnd: (behavior = 'smooth') => {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior });
    },
  }));

  const components = useMemo(
    () => ({
      Footer: () => <>{footer}</>,
    }),
    [footer],
  );

  if (items.length === 0 && empty) {
    return (
      <div
        data-testid="virtual-feed"
        data-mode={mode}
        data-first-item-index={firstItemIndex}
        className={cn('relative h-full min-h-0 w-full', className)}
      >
        {empty}
      </div>
    );
  }

  return (
    <div
      data-testid="virtual-feed"
      data-mode={mode}
      data-first-item-index={firstItemIndex}
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
        atBottomStateChange={onAtBottomChange}
        startReached={() => {
          if (mode === 'reverse' && hasPrevious && !isLoadingPrevious) loadPrevious?.();
        }}
        endReached={() => {
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
