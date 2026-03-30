import { Avatar } from '@org/shared';
import { useMeQuery } from '@org/entities';

interface UserPanelProps {
  onProfileClick?: () => void;
}

export function UserPanel({ onProfileClick }: UserPanelProps) {
  const { data: me } = useMeQuery();

  if (!me) return null;

  const displayName = me.email.slice(0, 8);

  return (
    <footer className="p-2 border-t border-border shrink-0">
      <button
        onClick={onProfileClick}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-elevated transition-colors"
      >
        <Avatar name={displayName} size="sm" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium truncate">{me.email}</p>
          <p className="text-xs text-text-muted">Online</p>
        </div>
        <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </footer>
  );
}
