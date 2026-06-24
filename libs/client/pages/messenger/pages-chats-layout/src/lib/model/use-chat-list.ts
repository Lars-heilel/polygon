import { useMemo, useState } from 'react';

import { getChatDisplayName, useGetChatsSuspenseQuery, usePresenceStore } from '@org/entities-chat';
import { useMeSuspenseQuery } from '@org/entities-user';

function getOtherUserInfo(
  chat: { members: Array<{ userId: string; profile: { avatarUrl: string | null } | null }> },
  myId: string,
): { userId: string; avatarUrl: string | null } | null {
  const member = chat.members.find((m) => m.userId !== myId);
  if (!member) return null;
  return { userId: member.userId, avatarUrl: member.profile?.avatarUrl ?? null };
}

export function useChatList() {
  const { data: chats } = useGetChatsSuspenseQuery();
  const { data: me } = useMeSuspenseQuery();
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    return chats
      .map((chat) => {
        const other = getOtherUserInfo(chat as never, me.id);
        return {
          id: chat.id,
          name: getChatDisplayName(chat, me.id),
          avatarUrl: other?.avatarUrl ?? chat.avatarUrl ?? undefined,
          lastMessage: chat.messages?.[0]?.text ?? 'Нет новых сообщений',
          time: chat.messages?.[0]?.createdAt ?? null,
          unread: 0,
          online: other ? (onlineUsers[other.userId] ?? false) : false,
        };
      })
      .filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [chats, me, onlineUsers, searchQuery]);

  return {
    chats: filteredChats,
    searchQuery,
    setSearchQuery,
    selectedChatId,
    setSelectedChatId,
  };
}
