import { memo } from 'react';

import { Avatar, formatTime } from '@org/shared';

import type { Message } from '../chat.api';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  senderName?: string;
}

export const MessageBubble = memo(function MessageBubble({ message, isMine, senderName }: MessageBubbleProps) {
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
