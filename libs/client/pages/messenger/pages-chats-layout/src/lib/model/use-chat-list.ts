import { useMemo, useState } from 'react';

import { getChatDisplayName, useGetChatsSuspenseQuery, usePresenceStore } from '@org/entities-chat';
import { useMeSuspenseQuery } from '@org/entities-user';

function getOtherUserId(
  chat: { members: Array<{ userId: string }> },
  myId: string,
): string | undefined {
  return chat.members.find((m) => m.userId !== myId)?.userId;
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
        const otherUserId = getOtherUserId(chat, me.id);
        return {
          id: chat.id,
          name: getChatDisplayName(chat, me.id),
          lastMessage: chat.messages?.[0]?.text ?? 'Нет новых сообщений',
          time: chat.messages?.[0]?.createdAt ?? null,
          unread: 0,
          online: otherUserId ? (onlineUsers[otherUserId] ?? false) : false,
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
