import { useMemo, useState } from 'react';

import { useGetChatsSuspenseQuery, useMeSuspenseQuery } from '@org/entities';

export function useChatList() {
  const { data: chats } = useGetChatsSuspenseQuery();
  const { data: me } = useMeSuspenseQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    return chats
      .map((chat) => {
        const otherMember = chat.members.find((m) => m.userId !== me.id);
        return {
          id: chat.id,
          name: otherMember?.userId.slice(0, 8) ?? chat.name ?? 'Chat',
          lastMessage: chat.messages?.[0]?.text ?? 'No messages yet',
          time: chat.messages?.[0]?.createdAt ?? '',
          unread: 0,
          online: false,
        };
      })
      .filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [chats, me, searchQuery]);

  return {
    chats: filteredChats,
    searchQuery,
    setSearchQuery,
    selectedChatId,
    setSelectedChatId,
  };
}
