import { memo, useEffect, useRef } from 'react';

import { type Message, useGetMessagesSuspenseQuery, useMeSuspenseQuery } from '@org/entities';
import { Avatar, Skeleton, formatTime } from '@org/shared';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderName?: string;
}

const MessageBubble = memo(function MessageBubble({ message, isMine, senderName }: MessageBubbleProps) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isMine && (
        <Avatar
          name={senderName?.slice(0, 2) ?? '?'}
          size="xs"
        />
      )}
      <div
        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
          isMine
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-surface-elevated text-text rounded-bl-md'
        }`}
      >
        <p className="break-words">{message.text}</p>
        <p className={`text-[10px] mt-1 text-right ${isMine ? 'text-white/60' : 'text-text-muted'}`}>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
});

function MessageBubbleSkeleton({ isMine = false, size = 'md' }: { isMine?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const widths = { sm: 'w-24', md: 'w-40', lg: 'w-56' };
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isMine && <Skeleton className="w-6 h-6 rounded-full shrink-0" />}
      <Skeleton className={`h-10 ${widths[size]} rounded-2xl`} />
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <MessageBubbleSkeleton isMine={false} size="md" />
      <MessageBubbleSkeleton isMine={true} size="lg" />
      <MessageBubbleSkeleton isMine={false} size="sm" />
      <MessageBubbleSkeleton isMine={true} size="md" />
      <MessageBubbleSkeleton isMine={false} size="lg" />
      <MessageBubbleSkeleton isMine={true} size="sm" />
    </div>
  );
}

interface MessageListProps {
  chatId: string;
}

export function MessageList({ chatId }: MessageListProps) {
  const { data: messages } = useGetMessagesSuspenseQuery(chatId);
  const { data: me } = useMeSuspenseQuery();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.length === 0 && (
        <p className="text-center text-sm text-text-muted py-8">No messages yet. Say hi!</p>
      )}

      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isMine={msg.senderId === me.id}
          senderName={msg.senderId?.slice(0, 8)}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
