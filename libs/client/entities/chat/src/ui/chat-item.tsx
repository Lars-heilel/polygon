import { memo } from 'react';

import { Avatar, Badge, Text, formatDate } from '@org/shared';

export interface ChatItemProps {
  id: string;
  name: string;
  avatarUrl?: string;
  lastMessage: string;
  time: string | null;
  unread?: number;
  online?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

export const ChatItem = memo(function ChatItem({
  name,
  avatarUrl,
  lastMessage,
  time,
  unread = 0,
  online = false,
  isActive = false,
  onClick,
}: ChatItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-elevated transition-colors ${
        isActive ? 'bg-primary/10' : ''
      }`}
    >
      <div className="relative shrink-0">
        <Avatar
          src={avatarUrl}
          name={name}
          size="md"
        />
        {online && (
          <Badge
            variant="success"
            size="sm"
            dot
            className="absolute bottom-0 right-0 border-2 border-surface"
          />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          {time && <span className="text-xs text-text-muted shrink-0">{formatDate(time)}</span>}
        </div>
        <div className="flex justify-between items-center gap-2">
          <Text
            size="xs"
            color="muted"
            className="truncate"
          >
            {lastMessage}
          </Text>
          {unread > 0 && (
            <Badge
              variant="primary"
              size="sm"
            >
              {unread}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
});
