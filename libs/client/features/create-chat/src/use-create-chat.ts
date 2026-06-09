import { useState } from 'react';

import type { Chat } from '@org/entities-chat';
import { useCreateDirectChatMutation } from '@org/entities-chat';
import { useSearchUsers } from '@org/entities-user';
import { useNavigate } from 'react-router';

export function useCreateChat() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: createChat, isPending } = useCreateDirectChatMutation();
  const search = useSearchUsers();

  const handleSelectUser = (targetUserId: string) => {
    createChat(
      { targetUserId },
      {
        onSuccess: (data: Chat) => {
          setIsOpen(false);
          search.onChange('');
          navigate(`/chats/${data.id}`);
        },
      },
    );
  };

  return {
    isOpen,
    setIsOpen,
    searchQuery: search.inputValue,
    setSearchQuery: search.onChange,
    users: search.results,
    isSearching: search.isLoading,
    isCreating: isPending,
    onSelectUser: handleSelectUser,
  };
}
