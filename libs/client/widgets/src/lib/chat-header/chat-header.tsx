import { useGetChatsQuery, useMeQuery } from '@org/entities';
import { Avatar, Badge } from '@org/shared';

interface ChatHeaderProps {
  chatId: string;
  onMenuClick?: () => void;
}

export function ChatHeader({ chatId, onMenuClick }: ChatHeaderProps) {
  const { data: chats } = useGetChatsQuery();
  const { data: me } = useMeQuery();

  const chat = chats?.find((c) => c.id === chatId);
  const otherMember = chat?.members.find((m) => m.userId !== me?.id);
  const displayName = otherMember ? otherMember.userId.slice(0, 8) : (chat?.name ?? 'Chat');

  return (
    <header className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0">
      <div className="relative">
        <Avatar
          name={displayName}
          size="md"
        />
        {false && (
          <Badge
            variant="primary"
            size="sm"
            dot
            className="absolute bottom-0 right-0 border-2 border-surface"
          />
        )}
      </div>
      <div className="flex-1">
        <h2 className="text-sm font-semibold">{displayName}</h2>
        <p className="text-xs text-green-500">Online</p>
      </div>
      <button
        onClick={onMenuClick}
        className="p-2 hover:bg-surface-elevated rounded-lg text-text-muted"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>
    </header>
  );
}
