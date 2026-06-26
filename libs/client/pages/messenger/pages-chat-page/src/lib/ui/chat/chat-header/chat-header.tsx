import { memo } from 'react';
import { useNavigate } from 'react-router';

import {
  getChatDisplayName,
  useChatStore,
  useGetChatsSuspenseQuery,
  usePresenceStore,
} from '@org/entities-chat';
import { useMeSuspenseQuery } from '@org/entities-user';
import { Avatar, Badge, Heading, Text, showComingSoonToast } from '@org/shared';

import { ChatHeaderSkeleton } from './chat-header-skeleton';

export { ChatHeaderSkeleton };

interface ChatHeaderProps {
  chatId: string;
  onMenuClick?: () => void;
}

export const ChatHeader = memo(function ChatHeader({ chatId }: ChatHeaderProps) {
  const navigate = useNavigate();
  const { data: chats } = useGetChatsSuspenseQuery();
  const { data: me } = useMeSuspenseQuery();
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const typingUsers = useChatStore((s) => s.typingUsers);

  const chat = chats.find((c) => c.id === chatId);
  const displayName = chat ? getChatDisplayName(chat, me.id) : 'Chat';

  const otherMember = chat?.members.find((m) => m.userId !== me.id);
  const otherUserId = otherMember?.userId;
  const otherAvatarUrl = otherMember?.profile?.avatarUrl;
  const isOnline = otherUserId ? (onlineUsers[otherUserId] ?? false) : false;
  const isTyping = otherUserId ? (typingUsers[otherUserId] ?? false) : false;

  return (
    <header className="px-4 py-3 border-b border-border flex items-center gap-3 sticky shrink-0">
      <button
        onClick={() => navigate('/chats')}
        aria-label="Back"
        className="p-2 hover:bg-surface-elevated rounded-lg transition-colors md:hidden"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="relative ">
        <Avatar
          src={otherAvatarUrl ?? chat?.avatarUrl ?? undefined}
          name={displayName}
          size="md"
        />
        {isOnline && (
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
        {isTyping ? (
          <Text
            size="xs"
            className="text-text-muted"
          >
            печатает...
          </Text>
        ) : isOnline ? (
          <Text
            size="xs"
            className="text-green-500"
          >
            Online
          </Text>
        ) : null}
      </div>
      <button
        onClick={showComingSoonToast}
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
