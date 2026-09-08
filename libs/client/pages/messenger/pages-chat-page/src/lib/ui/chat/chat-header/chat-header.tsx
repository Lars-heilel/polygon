import { memo, useState } from 'react';

import {
  getChatDisplayName,
  useChatStore,
  useGetChatsSuspenseQuery,
  usePresenceStore,
} from '@org/entities-chat';
import { useMeSuspenseQuery } from '@org/entities-user';
import { AvatarCarousel } from '@org/features-upload-avatar';
import { UserProfileModal } from '@org/features-user-profile';
import { Avatar, Badge, Heading, IconButton, Text } from '@org/shared';
import { useNavigate } from 'react-router';

import { ChatHeaderSkeleton } from './chat-header-skeleton';

export { ChatHeaderSkeleton };

interface ChatHeaderProps {
  chatId: string;
}

export const ChatHeader = memo(function ChatHeader({ chatId }: ChatHeaderProps) {
  const navigate = useNavigate();
  const { data: chats } = useGetChatsSuspenseQuery();
  const { data: me } = useMeSuspenseQuery();
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [avatarHistoryUserId, setAvatarHistoryUserId] = useState<string | null>(null);

  const chat = chats.find((c) => c.id === chatId);
  const displayName = chat ? getChatDisplayName(chat, me.id) : 'Chat';

  const otherMember = chat?.members.find((m) => m.userId !== me.id) ?? chat?.members[0];
  const otherUserId = otherMember?.userId ?? me.id;
  const otherAvatarUrl = otherMember?.profile?.avatarUrl ?? chat?.avatarUrl ?? null;
  const isOnline = otherUserId ? (onlineUsers[otherUserId] ?? false) : false;
  const isTyping = otherUserId ? (typingUsers[otherUserId] ?? false) : false;

  return (
    <header className="px-4 py-3 border-b border-border flex items-center gap-3 sticky shrink-0">
      <IconButton
        type="button"
        label="Back"
        size="md"
        variant="ghost"
        onClick={() => navigate('/chats')}
        className="md:hidden"
        icon={<BackIcon />}
      />
      {otherUserId && (
        <button
          onClick={() => setProfileUserId(otherUserId)}
          title="Open profile"
          className="chat-header-btn group flex flex-1 items-center gap-3 text-left"
        >
          <div className="relative ">
            <Avatar
              src={otherAvatarUrl ?? undefined}
              name={displayName}
              size="md"
            />
            {isOnline && (
              <Badge
                variant="success"
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
                color="muted"
              >
                typing...
              </Text>
            ) : isOnline ? (
              <Text
                size="xs"
                color="success"
              >
                Online
              </Text>
            ) : null}
          </div>
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      {!otherUserId && (
        <>
          <div className="relative ">
            <Avatar
              src={otherAvatarUrl ?? undefined}
              name={displayName}
              size="md"
            />
            {isOnline && (
              <Badge
                variant="success"
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
                color="muted"
              >
                typing...
              </Text>
            ) : isOnline ? (
              <Text
                size="xs"
                color="success"
              >
                Online
              </Text>
            ) : null}
          </div>
        </>
      )}
      {/* <button
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
      </button> */}

      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          chatId={chatId}
          onAvatarClick={() => setAvatarHistoryUserId(profileUserId)}
          onClose={() => setProfileUserId(null)}
        />
      )}
      {avatarHistoryUserId && (
        <AvatarCarousel
          isOpen
          onClose={() => setAvatarHistoryUserId(null)}
          userId={avatarHistoryUserId}
          readOnly
        />
      )}
    </header>
  );
});

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}
