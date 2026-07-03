import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useGetChatsSuspenseQuery } from '@org/entities-chat';
import { FileMessage, MessageBubble, useInfiniteMessagesQuery } from '@org/entities-message';
import type { Message } from '@org/entities-message';
import { useMeSuspenseQuery } from '@org/entities-user';
import { Text, socket } from '@org/shared';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

const INITIAL_OFFSET = 10_000;

interface ChatMessageRowProps {
  msg: Message;
  isMine: boolean;
  senderName?: string;
  senderAvatarUrl?: string;
}

const ChatMessageRow = memo(({ msg, isMine, senderName, senderAvatarUrl }: ChatMessageRowProps) => {
  return (
    <div className="px-4 pb-3">
      <MessageBubble
        message={msg}
        isMine={isMine}
        senderName={senderName}
        senderAvatarUrl={senderAvatarUrl}
      >
        {msg.type === 'TEXT' || (!msg.fileId && !msg.fileMime) ? (
          <span className="whitespace-pre-wrap wrap-break-word">{msg.text ?? ''}</span>
        ) : (
          <FileMessage
            message={msg}
            isMine={isMine}
          />
        )}
      </MessageBubble>
    </div>
  );
});

const EmptyState = memo(() => (
  <div className="relative flex-1 h-full w-full overflow-hidden">
    <div className="h-full flex justify-center content-center items-center">
      <Text
        size="sm"
        color="muted"
      >
        No messages yet. Say hi!
      </Text>
    </div>
  </div>
));

export const VirtualMessageList = memo(function MessageList({ chatId }: { chatId: string }) {
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMessagesQuery(chatId);
  const { data: me } = useMeSuspenseQuery();
  const { data: chats } = useGetChatsSuspenseQuery();
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const allMessages = useMemo(
    () => [...infiniteData.pages].reverse().flatMap((p) => p.messages),
    [infiniteData.pages],
  );

  const memberProfileMap = useMemo(() => {
    const chat = chats.find((c) => c.id === chatId);
    return new Map((chat?.members ?? []).map((m) => [m.userId, m.profile]));
  }, [chats, chatId]);

  const firstItemIndex = Math.max(0, INITIAL_OFFSET - allMessages.length);

  const handleStartReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: 'LAST',
      behavior: 'smooth',
      align: 'end',
    });
  }, []);

  const handleAtBottomChange = useCallback((bottom: boolean) => {
    setIsAtBottom(bottom);
    isAtBottomRef.current = bottom;
  }, []);

  const prevChatIdRef = useRef(chatId);

  useEffect(() => {
    if (prevChatIdRef.current === chatId) return;
    prevChatIdRef.current = chatId;

    setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({
        index: 'LAST',
        behavior: 'auto',
        align: 'end',
      });
    }, 0);
  }, [chatId]);

  useEffect(() => {
    const handler = (msg: Message) => {
      if (msg.chatId !== chatId || msg.senderId !== me.id) return;

      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: 'LAST',
          behavior: 'smooth',
          align: 'end',
        });
      }, 0);
    };

    socket.on('message:new', handler);
    return () => {
      socket.off('message:new', handler);
    };
  }, [chatId, me.id]);

  if (allMessages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="relative flex-1 h-full w-full">
      <Virtuoso
        ref={virtuosoRef}
        className="h-full"
        data={allMessages}
        computeItemKey={(index, msg) => msg.id}
        firstItemIndex={firstItemIndex}
        defaultItemHeight={80}
        increaseViewportBy={{ top: 600, bottom: 400 }}
        overscan={200}
        skipAnimationFrameInResizeObserver
        initialTopMostItemIndex={allMessages.length - 1}
        atBottomThreshold={24}
        followOutput={(bottom) => (bottom ? 'smooth' : false)}
        atBottomStateChange={handleAtBottomChange}
        startReached={handleStartReached}
        components={{
          Footer: () => <div className="h-6" />,
        }}
        itemContent={(index, msg) => {
          const profile = memberProfileMap.get(msg.senderId);
          return (
            <ChatMessageRow
              msg={msg}
              isMine={msg.senderId === me.id}
              senderName={profile?.displayName ?? profile?.name ?? undefined}
              senderAvatarUrl={profile?.avatarUrl ?? undefined}
            />
          );
        }}
      />

      {!isAtBottom && (
        <button
          className="absolute bottom-6 right-6 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-xs shadow-2xl hover:bg-primary/90 transition-all active:scale-95"
          onClick={scrollToBottom}
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
