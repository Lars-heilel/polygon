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
  const displayCreatedAt = message.forwardContext?.originalMessageCreatedAt ?? message.createdAt;

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
              'mb-1.5 min-w-0 leading-snug',
              isMine ? 'text-text-inverse/90' : 'text-text',
            )}
          >
            <div
              data-testid="forwarded-source"
              className={cn(
                'truncate text-[12px] font-semibold',
                isMine ? 'text-text-inverse' : 'text-primary',
              )}
            >
              {originalAuthorName}
            </div>
            {forwardedPreview ? (
              <div data-testid="forwarded-preview" className="mt-0.5 line-clamp-2 break-words text-[12px] opacity-85">
                {forwardedPreview}
              </div>
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
          <span>{formatTime(displayCreatedAt)}</span>
          {actionsSlot}
        </div>
      </div>
    </div>
  );
});

function getForwardedPreview(message: Message): string | null {
  const contextText = message.forwardContext?.preview.text?.trim();
  const messageText = message.text?.trim();
  if (contextText && messageText && contextText === messageText) return null;
  if (contextText) return contextText;

  if (message.media) return null;

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
