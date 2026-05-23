import { lazy, memo, Suspense, useCallback, useMemo, useRef, useState } from 'react';

import {
  MessageBubble,
  MessageBubbleSkeleton,
  useInfiniteMessagesQuery,
} from '@org/entities-message';
import { useGetChatsSuspenseQuery } from '@org/entities-chat';
import { useMeSuspenseQuery } from '@org/entities-user';
import type { Message } from '@org/entities-message';
import { Text } from '@org/shared';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

const MarkdownMessage = lazy(() =>
  import('@org/features-markdown').then((m) => ({ default: m.MarkdownMessage }))
);

interface ChatMessageRowProps {
  msg: Message;
  isMine: boolean;
  senderName?: string;
}

const ChatMessageRow = memo(({ msg, isMine, senderName }: ChatMessageRowProps) => {
  return (
    <div className="px-4 pb-3">
      <MessageBubble
        message={msg}
        isMine={isMine}
        senderName={senderName}
      >
        <Suspense fallback={<span className="text-text-muted text-xs">Loading...</span>}>
          <MarkdownMessage content={msg.text ?? ''} />
        </Suspense>
      </MessageBubble>
    </div>
  );
});

export const VirtualMessageList = memo(function MessageList({ chatId }: { chatId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteMessagesQuery(chatId);
  const { data: me } = useMeSuspenseQuery();
  const { data: chats } = useGetChatsSuspenseQuery();
  const [isAtBottom, setIsAtBottom] = useState(true);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const allMessages = useMemo(
    () => [...data.pages].reverse().flatMap((p) => p.messages),
    [data.pages],
  );

  const memberProfileMap = useMemo(() => {
    const chat = chats.find((c) => c.id === chatId);
    return new Map((chat?.members ?? []).map((m) => [m.userId, m.profile]));
  }, [chats, chatId]);

  const itemContent = useCallback(
    (_index: number, msg: Message) => {
      const profile = memberProfileMap.get(msg.senderId);
      return (
        <ChatMessageRow
          msg={msg}
          isMine={msg.senderId === me.id}
          senderName={profile?.displayName ?? profile?.name ?? undefined}
        />
      );
    },
    [me.id, memberProfileMap],
  );

  const Components = useMemo(
    () => ({
      Header: () => (
        <div className="w-full min-h-2.5">
          {isFetchingNextPage && (
            <div className="p-4">
              <MessageBubbleSkeleton
                isMine={false}
                size="sm"
              />
            </div>
          )}
        </div>
      ),
      EmptyPlaceholder: () => (
        <div className="flex justify-center py-20">
          <Text
            size="sm"
            color="muted"
          >
            No messages yet. Say hi!
          </Text>
        </div>
      ),
      Footer: () => <div className="h-6" />,
    }),
    [isFetchingNextPage],
  );

  return (
    <div className="relative flex-1 h-full w-full overflow-hidden">
      <Virtuoso
        key={chatId}
        ref={virtuosoRef}
        data={allMessages}
        className="h-full"
        computeItemKey={(_, msg) => msg.id}
        itemContent={itemContent}
        components={Components}
        firstItemIndex={Math.max(0, 10000 - allMessages.length)}
        initialTopMostItemIndex={allMessages.length > 0 ? allMessages.length - 1 : 0}
        atBottomStateChange={setIsAtBottom}
        followOutput={(bottom) => (bottom ? 'smooth' : false)}
        startReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        increaseViewportBy={400}
      />

      {!isAtBottom && allMessages.length > 0 && (
        <button
          className="absolute bottom-6 right-6 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-xs shadow-2xl hover:bg-primary/90 transition-all active:scale-95"
          onClick={() =>
            virtuosoRef.current?.scrollToIndex({
              index: allMessages.length - 1,
              behavior: 'smooth',
              align: 'end',
            })
          }
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
