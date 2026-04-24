import { useState } from 'react';

import { useCreateDirectChatMutation } from '@org/entities';

import { useSearchUsers } from '../../search/use-search-users';

export function useCreateChat() {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: createChat, isPending } = useCreateDirectChatMutation();
  const search = useSearchUsers();

  const handleSelectUser = (targetUserId: string) => {
    createChat(
      { targetUserId },
      {
        onSuccess: () => {
          setIsOpen(false);
          search.onChange('');
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
