import { useMemo, useState } from 'react';

import { useGetChatsQuery, useMeQuery } from '@org/entities';

export function useChatList() {
  const { data: chats, isLoading } = useGetChatsQuery();
  const { data: me } = useMeQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    if (!chats) return [];

    return chats
      .map((chat) => {
        const otherMember = chat.members.find((m) => m.userId !== me?.id);
        return {
          id: chat.id,
          name: otherMember?.userId.slice(0, 8) ?? chat.name ?? 'Chat',
          lastMessage: chat.messages?.[0]?.text ?? 'No messages yet',
          time: chat.messages?.[0]?.createdAt ?? '',
          unread: 0, // TODO: добавить подсчет непрочитанных
          online: false, // TODO: добавить статус online
        };
      })
      .filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [chats, me, searchQuery]);

  return {
    chats: filteredChats,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedChatId,
    setSelectedChatId,
  };
}
