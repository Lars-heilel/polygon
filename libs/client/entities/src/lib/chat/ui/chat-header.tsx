import { memo } from 'react';

import { Avatar, Badge, Heading, Text } from '@org/shared';

import { useMeSuspenseQuery } from '../../user/user.api';
import { useGetChatsSuspenseQuery } from '../chat.api';
import { getChatDisplayName } from '../chat.utils';
import { ChatHeaderSkeleton } from './chat-header-skeleton';

export { ChatHeaderSkeleton };

interface ChatHeaderProps {
  chatId: string;
  onMenuClick?: () => void;
}

export const ChatHeader = memo(function ChatHeader({ chatId, onMenuClick }: ChatHeaderProps) {
  const { data: chats } = useGetChatsSuspenseQuery();
  const { data: me } = useMeSuspenseQuery();

  const chat = chats.find((c) => c.id === chatId);
  const displayName = chat ? getChatDisplayName(chat, me.id) : 'Chat';

  return (
    <header className="px-4 py-3 border-b border-border flex items-center gap-3 sticky shrink-0">
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
        <Heading
          level={6}
          as="h2"
        >
          {displayName}
        </Heading>
        <Text
          size="xs"
          className="text-green-500"
        >
          Online
        </Text>
      </div>
      <button
        onClick={onMenuClick}
        aria-label="More options"
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
});
