import { memo, useCallback, useMemo, useRef, useState } from 'react';

import {
  MessageBubble,
  MessageBubbleSkeleton,
  useGetChatsSuspenseQuery,
  useInfiniteMessagesQuery,
  useMeSuspenseQuery,
} from '@org/entities';
import type { Message } from '@org/entities';
import { MarkdownMessage } from '@org/features';
import { Text } from '@org/shared';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

export const VirtualMessageList = memo(function MessageList({ chatId }: { chatId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteMessagesQuery(chatId);
  const { data: me } = useMeSuspenseQuery();
  const { data: chats } = useGetChatsSuspenseQuery();

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const allMessages = useMemo(
    () => [...data.pages].reverse().flatMap((page) => page.messages),
    [data.pages],
  );

  const memberProfileMap = useMemo(() => {
    const chat = chats.find((c) => c.id === chatId);
    return new Map((chat?.members ?? []).map((m) => [m.userId, m.profile]));
  }, [chats, chatId]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: allMessages.length - 1,
      behavior: 'smooth',
      align: 'end',
    });
  }, [allMessages.length]);

  return (
    <div className="relative flex-1 h-full w-full overflow-hidden bg-background">
      <Virtuoso
        key={chatId}
        ref={virtuosoRef}
        data={allMessages}
        className="h-full"
        computeItemKey={(_, msg: Message) => msg.id}
        firstItemIndex={Math.max(0, 10000 - allMessages.length)}
        initialTopMostItemIndex={allMessages.length > 0 ? allMessages.length - 1 : 0}
        atBottomStateChange={setIsAtBottom}
        atBottomThreshold={40}
        followOutput={(isAtBottom) => {
          if (isAtBottom) return 'smooth';
          return false;
        }}
        components={{
          Header: () => (
            <div className="w-full transition-all">
              {isFetchingNextPage ? (
                <div className="p-4">
                  <MessageBubbleSkeleton
                    isMine={false}
                    size="sm"
                  />
                </div>
              ) : (
                <div className="h-4" />
              )}
            </div>
          ),
          EmptyPlaceholder: () => (
            <div className="flex flex-col items-center justify-center h-full py-10">
              <Text
                size="sm"
                color="muted"
              >
                No messages yet. Say hi!
              </Text>
            </div>
          ),
          Footer: () => <div className="h-6" />,
        }}
        itemContent={(_, msg: Message) => {
          const senderProfile = memberProfileMap.get(msg.senderId);
          return (
            <div className="px-4 pb-3 outline-none">
              <MessageBubble
                message={msg}
                isMine={msg.senderId === me.id}
                senderName={senderProfile?.displayName ?? senderProfile?.name ?? undefined}
                contentSlot={<MarkdownMessage content={msg.text ?? ''} />}
              />
            </div>
          );
        }}
        startReached={loadMore}
        increaseViewportBy={400}
      />

      {!isAtBottom && allMessages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-6 right-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs shadow-2xl hover:opacity-90 transition-all active:scale-95"
        >
          <svg
            className="w-4 h-4 rotate-180"
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
    </div>
  );
});
