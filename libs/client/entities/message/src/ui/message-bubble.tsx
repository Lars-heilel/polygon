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
  const hasForwardContext = !!message.forwardContext;
  const forwardContextName = message.forwardContext?.originalAuthor.displayNameSnapshot
    ?? message.forwardContext?.originalAuthor.nameSnapshot
    ?? null;
  const originalAuthorName = forwardContextName;
  const forwardedPreview = getForwardedPreview(message);

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
        {hasForwardContext ? (
          <div
            className={cn(
              'mb-1.5 min-w-0 border-l-2 py-0.5 pl-2 leading-snug',
              isMine ? 'border-white/45 text-text-inverse/75' : 'border-primary/70 text-text-muted',
            )}
          >
            <div className={cn('truncate text-[11px] font-medium', isMine ? 'text-text-inverse/90' : 'text-text')}>
              {originalAuthorName}
            </div>
            {forwardedPreview ? (
              <div className="mt-0.5 line-clamp-2 break-words text-[12px] opacity-85">{forwardedPreview}</div>
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

function getForwardedPreview(message: Message): string | null {
  const contextText = message.forwardContext?.preview.text?.trim();
  if (contextText) return contextText;

  if (message.forwardContext?.preview.fileName) return message.forwardContext.preview.fileName;

  switch (message.forwardContext?.originalMessageType) {
    case 'IMAGE':
      return 'Photo';
    case 'VIDEO':
      return 'Video';
    case 'AUDIO':
      return 'Audio';
    case 'VOICE':
      return 'Voice message';
    case 'FILE':
      return 'File';
  }
  return null;
}
