import { useState } from 'react';
import { useCreateDirectChatMutation, useGetChatsQuery } from '@org/entities';

interface User {
  id: string;
  name: string;
  email: string;
  online?: boolean;
}

export function useCreateChat() {
  const { data: chats } = useGetChatsQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { mutate: createChat, isPending } = useCreateDirectChatMutation();

  // Получаем всех уникальных пользователей из чатов
  const users: User[] = (chats ?? []).flatMap((chat) =>
    chat.members.map((member) => ({
      id: member.userId,
      name: member.userId.slice(0, 8),
      email: `${member.userId.slice(0, 8)}@polygon.app`,
      online: false, // TODO: добавить статус online
    }))
  );

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectUser = (targetUserId: string) => {
    createChat(
      { targetUserId },
      {
        onSuccess: () => {
          setIsOpen(false);
          setSearchQuery('');
        },
      }
    );
  };

  return {
    isOpen,
    setIsOpen,
    searchQuery,
    setSearchQuery,
    users: filteredUsers,
    isCreating: isPending,
    onSelectUser: handleSelectUser,
  };
}
