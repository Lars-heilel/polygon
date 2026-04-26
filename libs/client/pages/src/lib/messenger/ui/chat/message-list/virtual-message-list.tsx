import { memo, useMemo, useRef } from 'react';

import {
  MessageBubble,
  MessageBubbleSkeleton,
  MessageListSkeleton,
  useGetChatsSuspenseQuery,
  useInfiniteMessagesQuery,
  useMeSuspenseQuery,
} from '@org/entities';
import type { Message } from '@org/entities';
import { MarkdownMessage, useVirtualChat } from '@org/features';
import { type VirtualItem, useVirtualizer } from '@tanstack/react-virtual';

export { MessageListSkeleton };

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  senderName?: string;
  measureRef: (el: HTMLElement | null) => void;
  index: number;
  start: number;
}

const MessageItem = memo(function MessageItem({
  message,
  isMine,
  senderName,
  measureRef,
  index,
  start,
}: MessageItemProps) {
  return (
    <div
      ref={measureRef}
      data-index={index}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${start}px)`,
        padding: '4px 16px',
        boxSizing: 'border-box',
      }}
    >
      <MessageBubble
        message={message}
        isMine={isMine}
        senderName={senderName}
        contentSlot={<MarkdownMessage content={message.text ?? ''} />}
      />
    </div>
  );
});

export function VirtualMessageList({ chatId }: { chatId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteMessagesQuery(chatId);
  const { data: me } = useMeSuspenseQuery();
  const { data: chats } = useGetChatsSuspenseQuery();

  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () =>
      data.pages
        .slice()
        .reverse()
        .flatMap((p) => p.messages),
    [data.pages],
  );

  const memberProfileMap = useMemo(
    () =>
      new Map(
        (chats.find((c) => c.id === chatId)?.members ?? []).map((m) => [m.userId, m.profile]),
      ),
    [chats, chatId],
  );

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 85,
    overscan: 12,
    measureElement: (el) => (el as HTMLElement).offsetHeight,
    getItemKey: (index: number) => `${chatId}-${messages[index]?.id ?? index}`,
  });

  const { isUserUp, scrollToBottom } = useVirtualChat({
    chatId,
    messages,
    virtualizer: rowVirtualizer,
    scrollRef,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  return (
    <div
      key={chatId}
      className="relative flex-1 overflow-hidden flex flex-col"
    >
      {isUserUp && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm shadow-xl hover:bg-primary/90 transition-all active:scale-95"
        >
          <span>↓</span> New messages
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ contain: 'strict' }}
      >
        {isFetchingNextPage && (
          <div className="w-full py-4 px-4 flex flex-col gap-2">
            <MessageBubbleSkeleton
              isMine={false}
              size="sm"
            />
          </div>
        )}

        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem: VirtualItem) => {
            const msg = messages[virtualItem.index];
            if (!msg) return null;
            const senderProfile = memberProfileMap.get(msg.senderId);

            return (
              <MessageItem
                key={virtualItem.key}
                index={virtualItem.index}
                start={virtualItem.start}
                measureRef={rowVirtualizer.measureElement}
                message={msg}
                isMine={msg.senderId === me.id}
                senderName={senderProfile?.displayName ?? senderProfile?.name}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
