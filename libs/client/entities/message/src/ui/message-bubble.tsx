import { type ReactNode, memo } from 'react';

import { Avatar, formatTime } from '@org/shared';

import type { Message } from '../message.api';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderName?: string;
  senderAvatarUrl?: string;
  contentSlot?: ReactNode;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
  senderName,
  senderAvatarUrl,
  children,
}: MessageBubbleProps & { children: React.ReactNode }) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse lg:flex-row' : 'flex-row'}`}>
      {!isMine && (
        <Avatar
          src={senderAvatarUrl}
          name={senderName?.slice(0, 2) ?? '?'}
          size="xs"
        />
      )}
      <div
        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
          isMine
            ? 'bg-primary text-white rounded-br-md lg:rounded-bl-md'
            : 'bg-surface-elevated text-text rounded-bl-md'
        }`}
      >
        <div className="wrap-break-words">{children}</div>
        <p
          className={`text-[10px] mt-1 text-right ${isMine ? 'text-white/60' : 'text-text-muted'}`}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
});
