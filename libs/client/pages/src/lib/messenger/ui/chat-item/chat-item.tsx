import { Avatar, Badge } from '@org/shared';
import { formatDate } from '@org/shared';

interface ChatItemProps {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread?: number;
  online?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

export function ChatItem({
  name,
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
          name={name}
          size="md"
        />
        {online && (
          <Badge
            variant="primary"
            size="sm"
            dot
            className="absolute bottom-0 right-0 border-2 border-surface"
          />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          <span className="text-xs text-text-muted shrink-0">{formatDate(time)}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <p className="text-xs text-text-muted truncate">{lastMessage}</p>
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
}
