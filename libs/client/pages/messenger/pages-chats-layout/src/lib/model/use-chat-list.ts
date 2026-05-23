import { useMemo, useState } from 'react';

import { getChatDisplayName, useGetChatsSuspenseQuery } from '@org/entities-chat';
import { useMeSuspenseQuery } from '@org/entities-user';

export function useChatList() {
  const { data: chats } = useGetChatsSuspenseQuery();
  const { data: me } = useMeSuspenseQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    return chats
      .map((chat) => ({
        id: chat.id,
        name: getChatDisplayName(chat, me.id),
        lastMessage: chat.messages?.[0]?.text ?? 'No messages yet',
        time: chat.messages?.[0]?.createdAt ?? '',
        unread: 0,
        online: false,
      }))
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
