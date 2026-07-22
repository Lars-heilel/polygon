import { type ReactNode, memo } from 'react';

import { Avatar, cn, formatTime } from '@org/shared';

import type { Message } from '../message.api.js';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderName?: string;
  senderAvatarUrl?: string;
  actionsSlot?: ReactNode;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
  senderName,
  senderAvatarUrl,
  actionsSlot,
  children,
}: MessageBubbleProps & { children: React.ReactNode }) {
  const forwardedFromName = message.forwardedFromSender?.displayName
    ?? message.forwardedFromSender?.name
    ?? (message.forwardedFromSenderId ? 'Unknown sender' : null);

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
        {message.forwardedFromId ? (
          <div
            className={cn(
              'mb-1.5 min-w-0 border-l-2 pl-2 text-[11px] leading-snug',
              isMine ? 'border-white/35 text-text-inverse/75' : 'border-primary/60 text-text-muted',
            )}
          >
            <div className={cn('truncate font-medium', isMine ? 'text-text-inverse/90' : 'text-text')}>
              Forwarded from {forwardedFromName ?? 'Unknown sender'}
            </div>
            {message.forwardedFromCreatedAt ? (
              <div className="truncate">{formatTime(message.forwardedFromCreatedAt)}</div>
            ) : null}
          </div>
        ) : null}
        <div className="min-w-0 break-words [overflow-wrap:anywhere]">{children}</div>
        <div
          className={cn(
            'mt-1 flex items-center justify-end gap-2 text-[10px]',
            isMine ? 'text-text-inverse/70' : 'text-text-muted',
          )}
        >
          {message.editedAt ? <span>edited</span> : null}
          <span>{formatTime(message.createdAt)}</span>
          {actionsSlot}
        </div>
      </div>
    </div>
  );
});
