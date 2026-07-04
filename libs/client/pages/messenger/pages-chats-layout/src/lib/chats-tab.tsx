import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import { ChatItem } from '@org/entities-chat';
import { useMeQuery, useSearchUsers } from '@org/entities-user';
import { useChatList } from '@org/entities-chat';
import { useCreateChat, CreateChatModal } from '@org/features-create-chat';
import { UserProfileModal } from '@org/features-user-profile';
import { Avatar, Input, Logo, Spinner, Text } from '@org/shared';

interface ChatsTabProps {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
}

export function ChatsTab({ selectedChatId, onSelectChat }: ChatsTabProps) {
  const navigate = useNavigate();
  const { data: me } = useMeQuery();
  const { chats, selectedChatId: internalSelectedChatId, setSelectedChatId } = useChatList(me?.id ?? '');
  const search = useSearchUsers();
  const {
    isOpen: isCreateChatOpen,
    setIsOpen: setIsCreateChatOpen,
    users,
    searchQuery: userSearchQuery,
    setSearchQuery: setUserSearchQuery,
    isCreating,
  } = useCreateChat();
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const isSearchActive = search.inputValue.trim().length >= 2;

  const handleSelectUser = useCallback((userId: string) => {
    setProfileUserId(userId);
  }, []);

  const handleCloseProfile = useCallback(() => {
    setProfileUserId(null);
  }, []);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      if (onSelectChat) {
        onSelectChat(chatId);
      } else {
        setSelectedChatId(chatId);
      }
      navigate(`/chats/${chatId}`);
    },
    [onSelectChat, setSelectedChatId, navigate],
  );

  return (
    <>
      <header className="px-4 py-3 border-b border-border flex items-center shrink-0">
        <Logo />
      </header>

      <div className="px-3 py-2 border-b border-border shrink-0">
        <Input
          value={search.inputValue}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder="Search chats..."
          size="sm"
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
      </div>

      <nav className="flex-1 overflow-y-auto">
        {isSearchActive ? (
          <>
            {search.isLoading && (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            )}
            {!search.isLoading && search.results.length === 0 && (
              <Text size="sm" color="muted" className="text-center py-4">
                No users found
              </Text>
            )}
            {search.results.map((user) => (
              <button
                key={user.id}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated text-left transition-colors"
                onClick={() => handleSelectUser(user.id)}
              >
                <Avatar
                  src={user.avatarUrl ?? undefined}
                  name={user.displayName ?? user.name}
                  size="sm"
                />
                <div className="min-w-0">
                  <Text size="sm" weight="medium" className="truncate">
                    {user.displayName ?? user.name}
                  </Text>
                  <Text size="xs" color="muted" className="truncate">
                    @{user.name}
                  </Text>
                </div>
              </button>
            ))}
          </>
        ) : (
          <>
            {chats.length === 0 && (
              <Text size="sm" color="muted" className="text-center py-4">
                No chats yet
              </Text>
            )}
            {chats.map((chat) => (
              <ChatItem
                key={chat.id}
                {...chat}
                isActive={chat.id === (selectedChatId ?? internalSelectedChatId)}
                onClick={() => handleSelectChat(chat.id)}
              />
            ))}
          </>
        )}
      </nav>

      <CreateChatModal
        isOpen={isCreateChatOpen}
        onClose={() => setIsCreateChatOpen(false)}
        users={users}
        searchQuery={userSearchQuery}
        onSearchChange={setUserSearchQuery}
        onSelectUser={handleSelectUser}
        isCreating={isCreating}
      />

      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          onClose={handleCloseProfile}
          showSendButton
        />
      )}
    </>
  );
}
