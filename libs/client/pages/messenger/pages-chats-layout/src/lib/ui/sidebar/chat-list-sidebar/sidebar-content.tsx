import { useCallback } from 'react';

import { ChatItem } from '@org/entities-chat';
import { useCreateChat } from '@org/features-create-chat';
import { useSearchUsers } from '@org/features-search';
import { Spinner, Text } from '@org/shared';
import { CurrentUserWidget } from '@org/widgets-current-user';

import { useChatList } from '../../../model/use-chat-list';
import { CreateChatModal } from '../../modals/create-chat-modal';
import { ChatSearch } from '../chat-search';
import { SidebarHeader } from '../sidebar-header';

interface SidebarContentProps {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
  onMenuClick: () => void;
  onSettingsClick?: () => void;
}

export function SidebarContent({
  selectedChatId,
  onSelectChat,
  onMenuClick,
  onSettingsClick,
}: SidebarContentProps) {
  const { chats, selectedChatId: internalSelectedChatId, setSelectedChatId } = useChatList();
  const search = useSearchUsers();
  const {
    isOpen: isCreateChatOpen,
    setIsOpen: setIsCreateChatOpen,
    users,
    searchQuery: userSearchQuery,
    setSearchQuery: setUserSearchQuery,
    isCreating,
    onSelectUser,
  } = useCreateChat();

  const isSearchActive = search.inputValue.trim().length >= 2;

  const handleSelectChat = useCallback(
    (chatId: string) => {
      if (onSelectChat) {
        onSelectChat(chatId);
      } else {
        setSelectedChatId(chatId);
      }
    },
    [onSelectChat, setSelectedChatId],
  );

  return (
    <>
      <SidebarHeader onMenuClick={onMenuClick} />
      <ChatSearch
        value={search.inputValue}
        onChange={search.onChange}
      />

      <nav className="flex-1 overflow-y-auto">
        {isSearchActive ? (
          <>
            {search.isLoading && (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            )}
            {!search.isLoading && search.results.length === 0 && (
              <Text
                size="sm"
                color="muted"
                className="text-center py-4"
              >
                No users found
              </Text>
            )}
            {search.results.map((user) => (
              <button
                key={user.id}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated text-left transition-colors"
                onClick={() => onSelectUser(user.id)}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-primary">
                    {(user.displayName ?? user.name).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <Text
                    size="sm"
                    weight="medium"
                    className="truncate"
                  >
                    {user.displayName ?? user.name}
                  </Text>
                  <Text
                    size="xs"
                    color="muted"
                    className="truncate"
                  >
                    @{user.name}
                  </Text>
                </div>
              </button>
            ))}
          </>
        ) : (
          <>
            {chats.length === 0 && (
              <Text
                size="sm"
                color="muted"
                className="text-center py-4"
              >
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

      <CurrentUserWidget onSettingsClick={onSettingsClick} />

      <CreateChatModal
        isOpen={isCreateChatOpen}
        onClose={() => setIsCreateChatOpen(false)}
        users={users}
        searchQuery={userSearchQuery}
        onSearchChange={setUserSearchQuery}
        onSelectUser={onSelectUser}
        isCreating={isCreating}
      />
    </>
  );
}
