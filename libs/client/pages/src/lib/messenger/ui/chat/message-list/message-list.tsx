import { memo } from 'react';

import {
  MessageBubble,
  MessageBubbleSkeleton,
  MessageListSkeleton,
  useGetChatsSuspenseQuery,
  useInfiniteMessagesQuery,
  useMeSuspenseQuery,
} from '@org/entities';
import type { Message } from '@org/entities';
import { MarkdownMessage, useInfiniteScrollList } from '@org/features';
import { Text } from '@org/shared';
import { useVirtualizer } from '@tanstack/react-virtual';

interface MessageItemProps {
  message: Message;
  isMine: boolean;
  senderName?: string;
}

const MessageItem = memo(function MessageItem({ message, isMine, senderName }: MessageItemProps) {
  return (
    <MessageBubble
      message={message}
      isMine={isMine}
      senderName={senderName}
      contentSlot={<MarkdownMessage content={message.text ?? ''} />}
    />
  );
});

export { MessageListSkeleton };

interface MessageListProps {
  chatId: string;
}

export function MessageList({ chatId }: MessageListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteMessagesQuery(chatId);
  const { data: me } = useMeSuspenseQuery();
  const { data: chats } = useGetChatsSuspenseQuery();

  const { scrollRef, newestSentinelRef, olderSentinelRef, isAtNewest, scrollToNewest } =
    useInfiniteScrollList({ fetchNextPage, hasNextPage, isFetchingNextPage });

  const memberProfileMap = new Map(
    (chats.find((c) => c.id === chatId)?.members ?? []).map((m) => [m.userId, m.profile]),
  );

  const messages = data.pages.flatMap((p) => [...p.messages].reverse());
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef,
    estimateSize: () => 80, // Примерная высота сообщения
    overscan: 5, // Сколько элементов рендерить за пределами видимости
  });
  return (
    <div className="relative flex-1 overflow-hidden">
      {!isAtNewest && (
        <button
          onClick={scrollToNewest}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-white text-xs shadow-lg hover:bg-primary/90 transition-colors"
        >
          <svg
            className="w-3.5 h-3.5 rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
          New messages
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex flex-col-reverse h-full overflow-y-auto px-4 py-4 gap-3"
      >
        <div
          ref={newestSentinelRef}
          className="shrink-0"
        />

        {messages.length === 0 && (
          <Text
            size="sm"
            color="muted"
            className="text-center py-8"
          >
            No messages yet. Say hi!
          </Text>
        )}

        {messages.map((msg) => {
          const senderProfile = memberProfileMap.get(msg.senderId);
          return (
            <MessageItem
              key={msg.id}
              message={msg}
              isMine={msg.senderId === me.id}
              senderName={senderProfile?.displayName ?? senderProfile?.name ?? undefined}
            />
          );
        })}

        {isFetchingNextPage && (
          <div className="flex flex-col gap-3">
            <MessageBubbleSkeleton
              isMine={false}
              size="md"
            />
            <MessageBubbleSkeleton
              isMine={true}
              size="sm"
            />
          </div>
        )}

        <div
          ref={olderSentinelRef}
          className="shrink-0"
        />
      </div>
    </div>
  );
}
