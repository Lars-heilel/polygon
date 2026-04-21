import { useCallback, useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';

import {
  MessageBubble,
  MessageBubbleSkeleton,
  MessageListSkeleton,
  useGetChatsSuspenseQuery,
  useInfiniteMessagesQuery,
  useMeSuspenseQuery,
} from '@org/entities';
import { Text } from '@org/shared';

export { MessageListSkeleton };

interface MessageListProps {
  chatId: string;
}

export function MessageList({ chatId }: MessageListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteMessagesQuery(chatId);
  const { data: me } = useMeSuspenseQuery();
  const { data: chats } = useGetChatsSuspenseQuery();

  const [scrollEl, setScrollEl] = useState<Element | null>(null);
  const scrollRef = useCallback((node: HTMLDivElement | null) => setScrollEl(node), []);

  // newestSentinel — FIRST in DOM → visual bottom (newest messages area)
  // visible = user is at the bottom seeing new messages → hide button
  const { ref: newestSentinelRef, inView: isAtNewest } = useInView({ root: scrollEl, threshold: 0 });

  // olderSentinel — LAST in DOM → visual top (oldest messages area)
  // visible = user scrolled all the way up → load older messages
  const { ref: olderSentinelRef, inView: shouldLoadMore } = useInView({ root: scrollEl, threshold: 0 });

  useEffect(() => {
    if (shouldLoadMore && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [shouldLoadMore, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll to bottom (newest) on initial mount
  useEffect(() => {
    if (!scrollEl) return;
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }, [scrollEl]);

  const memberProfileMap = new Map(
    (chats.find((c) => c.id === chatId)?.members ?? []).map((m) => [m.userId, m.profile]),
  );

  // Flatten pages with newest first in DOM:
  // pages[0] = newest batch [msg951..msg1000] → reversed = [msg1000..msg951]
  // pages[1] = older batch  [msg901..msg950] → reversed = [msg950..msg901]
  // Combined DOM: [msg1000..msg951, msg950..msg901]
  // flex-col-reverse visual: msg901(top) ... msg1000(bottom) ← oldest top, newest bottom ✓
  const messages = data.pages.flatMap((p) => [...p.messages].reverse());

  const scrollToNewest = () => {
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      {!isAtNewest && (
        <button
          onClick={scrollToNewest}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-white text-xs shadow-lg hover:bg-primary/90 transition-colors"
        >
          <svg className="w-3.5 h-3.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          New messages
        </button>
      )}

      {/*
        flex-col-reverse: FIRST child = visual BOTTOM, LAST child = visual TOP
        DOM: [newestSentinel, msg1000, ..., msg901, olderSentinel]
        Visual: olderSentinel(top) → msg901 → ... → msg1000 → newestSentinel(bottom)
      */}
      <div ref={scrollRef} className="flex flex-col-reverse h-full overflow-y-auto px-4 py-4 gap-3">

        {/* FIRST = visual bottom = newest messages area */}
        <div ref={newestSentinelRef} className="shrink-0" />

        {messages.length === 0 && (
          <Text size="sm" color="muted" className="text-center py-8">No messages yet. Say hi!</Text>
        )}

        {messages.map((msg) => {
          const senderProfile = memberProfileMap.get(msg.senderId);
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={msg.senderId === me.id}
              senderName={senderProfile?.displayName ?? senderProfile?.name ?? undefined}
            />
          );
        })}

        {isFetchingNextPage && (
          <div className="flex flex-col gap-3">
            <MessageBubbleSkeleton isMine={false} size="md" />
            <MessageBubbleSkeleton isMine={true} size="sm" />
          </div>
        )}

        {/* LAST = visual top = oldest messages area */}
        <div ref={olderSentinelRef} className="shrink-0" />

      </div>
    </div>
  );
}
