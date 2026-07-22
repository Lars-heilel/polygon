import { type ReactNode, memo } from 'react';

import { Avatar, cn, formatTime } from '@org/shared';

import type { Message } from '../message.api.js';

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
    <div className={`flex min-w-0 items-end gap-2 ${isMine ? 'flex-row-reverse lg:flex-row' : 'flex-row'}`}>
      {!isMine && (
        <Avatar
          src={senderAvatarUrl}
          name={senderName?.slice(0, 2) ?? '?'}
          size="xs"
        />
      )}
      <div
        data-testid="message-bubble"
        className={cn(
          'min-w-0 max-w-[min(82vw,32rem)] px-4 py-2.5 text-sm sm:max-w-[70%]',
          'rounded-lg border shadow-[var(--shadow-surface)]',
          isMine
            ? 'border-primary bg-primary text-text-inverse rounded-br-sm lg:rounded-bl-sm'
            : 'border-border bg-surface text-text rounded-bl-sm',
        )}
      >
        <div className="min-w-0 break-words [overflow-wrap:anywhere]">{children}</div>
        <p
          className={cn(
            'text-[10px] mt-1 text-right',
            isMine ? 'text-text-inverse/70' : 'text-text-muted',
          )}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
});
