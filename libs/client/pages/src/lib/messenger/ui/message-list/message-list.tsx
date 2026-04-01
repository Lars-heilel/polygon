import { useEffect, useRef } from 'react';

import { type Message, useGetMessagesQuery, useMeQuery } from '@org/entities';
import { Avatar, Spinner, formatTime } from '@org/shared';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderName?: string;
}

function MessageBubble({ message, isMine, senderName }: MessageBubbleProps) {
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
        <p
          className={`text-[10px] mt-1 text-right ${isMine ? 'text-white/60' : 'text-text-muted'}`}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

interface MessageListProps {
  chatId: string;
}

export function MessageList({ chatId }: MessageListProps) {
  const { data: messages = [], isLoading } = useGetMessagesQuery(chatId);
  const { data: me } = useMeQuery();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {isLoading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!isLoading && messages.length === 0 && (
        <p className="text-center text-sm text-text-muted py-8">No messages yet. Say hi!</p>
      )}

      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isMine={msg.senderId === me?.id}
          senderName={msg.senderId.slice(0, 8)}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
