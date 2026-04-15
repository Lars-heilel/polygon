import { memo } from 'react';

import { useGetChatsSuspenseQuery, useMeSuspenseQuery } from '@org/entities';
import { Avatar, Badge, Heading, Skeleton, Text } from '@org/shared';

interface ChatHeaderProps {
  chatId: string;
  onMenuClick?: () => void;
}

export function ChatHeaderSkeleton() {
  return (
    <header className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0 h-[57px]">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </header>
  );
}

export const ChatHeader = memo(function ChatHeader({ chatId, onMenuClick }: ChatHeaderProps) {
  const { data: chats } = useGetChatsSuspenseQuery();
  const { data: me } = useMeSuspenseQuery();

  const chat = chats.find((c) => c.id === chatId);
  const otherMember = chat?.members.find((m) => m.userId !== me.id);
  const otherProfile = otherMember?.profile;
  const displayName = otherProfile?.displayName ?? otherProfile?.name ?? chat?.name ?? 'Chat';

  return (
    <header className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0">
      <div className="relative">
        <Avatar name={displayName} size="md" />
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
        <Heading level={6} as="h2">{displayName}</Heading>
        <Text size="xs" className="text-green-500">Online</Text>
      </div>
      <button
        onClick={onMenuClick}
        aria-label="More options"
        className="p-2 hover:bg-surface-elevated rounded-lg text-text-muted"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
});
