import { useMemo, useState } from 'react';

import { useGetChatsSuspenseQuery } from './chat.api';
import { getMessagePreview } from './chat-preview';
import { getChatDisplayName } from './chat.utils';
import { usePresenceStore } from './presence.store';

function getOtherUserInfo(
  chat: { members: Array<{ userId: string; profile: { avatarUrl: string | null } | null }> },
  myId: string,
): { userId: string; avatarUrl: string | null } | null {
  const member = chat.members.find((m) => m.userId !== myId) ?? chat.members.find((m) => m.userId === myId);
  if (!member) return null;
  return { userId: member.userId, avatarUrl: member.profile?.avatarUrl ?? null };
}

export function useChatList(myId: string) {
  const { data: chats } = useGetChatsSuspenseQuery();
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    return chats
      .map((chat) => {
        const other = getOtherUserInfo(chat as never, myId);
        return {
          id: chat.id,
          name: getChatDisplayName(chat, myId),
          avatarUrl: other?.avatarUrl ?? chat.avatarUrl ?? undefined,
          lastMessage: getMessagePreview(chat.lastMessage),
          time: chat.lastMessage?.createdAt ?? null,
          unread: chat.unreadCount ?? 0,
          online: other ? (onlineUsers[other.userId] ?? false) : false,
        };
      })
      .filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [chats, myId, onlineUsers, searchQuery]);

  return {
    chats: filteredChats,
    searchQuery,
    setSearchQuery,
    selectedChatId,
    setSelectedChatId,
  };
}
