import { type ReactNode, cloneElement, isValidElement, memo } from 'react';

import { Avatar, cn, formatTime } from '@org/shared';

import type { Message } from '../message.api.js';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderName?: string;
  senderAvatarUrl?: string;
  actionsSlot?: ReactNode;
  showAvatar?: boolean;
  showTime?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
  senderName,
  senderAvatarUrl,
  actionsSlot,
  showAvatar = true,
  showTime = true,
  children,
}: MessageBubbleProps & { children: React.ReactNode }) {
  const hasForwardContext = !!message.forwardContext;
  const forwardContextName = message.forwardContext?.originalAuthor.displayNameSnapshot
    ?? message.forwardContext?.originalAuthor.nameSnapshot
    ?? null;
  const originalAuthorName = forwardContextName;
  const forwardedPreview = getForwardedPreview(message);
  const displayCreatedAt = message.forwardContext?.originalMessageCreatedAt ?? message.createdAt;

  const mime = message.media?.mime ?? '';
  const isVisualMedia = (message.type === 'IMAGE' && mime.startsWith('image/'))
    || (message.media?.category === 'VIDEO' && mime.startsWith('video/'));
  const hasCaption = !!message.text?.trim();
  const overlayMode = isVisualMedia && !hasCaption && !hasForwardContext;
  const isEmojiOnly = !message.media && !hasForwardContext && isEmojiOnlyText(message.text);
  const actions = overlayMode && isValidElement(actionsSlot)
    ? cloneElement(actionsSlot, { tone: 'onMedia' } as { tone: 'onMedia' })
    : actionsSlot;

  return (
    <div className="group flex min-w-0 items-end gap-2 flex-row">
      {!isMine && showAvatar && (
        <Avatar
          src={senderAvatarUrl}
          name={senderName?.slice(0, 2) ?? '?'}
          size="sm"
        />
      )}
      {!isMine && !showAvatar && <span aria-hidden="true" className="w-8 shrink-0" />}
      <div
        data-testid="message-bubble"
        className={cn(
          'msg-bubble',
          isMine ? 'msg-bubble--mine' : 'msg-bubble--theirs',
          isVisualMedia && 'msg-bubble--media relative',
          isEmojiOnly && 'msg-bubble--emoji-only',
          !isVisualMedia && !isEmojiOnly && 'px-4 py-2.5',
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
        {overlayMode && (showTime || actions) ? (
          <div data-testid="message-media-overlay" className="msg-media-overlay">
            {message.editedAt ? <span>edited</span> : null}
            {showTime ? <span>{formatTime(displayCreatedAt)}</span> : null}
            {actions ? (
              <span className="inline-flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                {actions}
              </span>
            ) : null}
          </div>
        ) : null}
        {!overlayMode && (showTime || actionsSlot) ? (
          <div
            className={cn(
              'mt-1 flex items-center justify-end gap-2 text-[10px]',
              isMine ? 'text-white/85' : 'text-text-muted',
            )}
          >
            {message.editedAt ? <span>edited</span> : null}
            {showTime ? <span>{formatTime(displayCreatedAt)}</span> : null}
            {actionsSlot ? (
              <span className="inline-flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                {actionsSlot}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});

const EMOJI_ONLY_PATTERN = /^(?:\p{Extended_Pictographic}|\u200D|\uFE0F|\s)+$/u;

function isEmojiOnlyText(text: string | null | undefined): boolean {
  const value = text?.trim();
  if (!value) return false;
  if (value.length > 30) return false;
  return EMOJI_ONLY_PATTERN.test(value);
}

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
