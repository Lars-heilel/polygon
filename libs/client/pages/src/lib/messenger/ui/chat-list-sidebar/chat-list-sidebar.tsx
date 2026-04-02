import { useState } from 'react';

import { useCreateDirectChatMutation } from '@org/entities';
import { useChatList, useCreateChat, useSearchUsers } from '@org/features';

import { ChatItem } from '../chat-item';
import { ChatSearch } from '../chat-search';
import { CreateChatModal } from '../create-chat-modal';
import { ProfileModal } from '../profile-modal';
import { SettingsModal } from '../settings-modal';
import { SidebarHeader } from '../sidebar-header';
import { UserPanel } from '../user-panel';

interface ChatListSidebarProps {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
}

export function ChatListSidebar({ selectedChatId, onSelectChat }: ChatListSidebarProps) {
  const {
    chats,
    isLoading,
    selectedChatId: internalSelectedChatId,
    setSelectedChatId,
  } = useChatList();

  const search = useSearchUsers();
  const { mutate: createDirectChat } = useCreateDirectChatMutation();

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSelectChat = (chatId: string) => {
    if (onSelectChat) {
      onSelectChat(chatId);
    } else {
      setSelectedChatId(chatId);
    }
  };

  return (
    <>
      <aside
        className={`${isSidebarOpen ? 'w-80' : 'w-0'} shrink-0 border-r border-border flex flex-col bg-surface transition-all duration-300 overflow-hidden`}
      >
        <SidebarHeader
          onMenuClick={() => setIsSidebarOpen(false)}
          onNewChatClick={() => setIsCreateChatOpen(true)}
        />
        <ChatSearch
          value={search.inputValue}
          onChange={search.onChange}
        />
        <nav className="flex-1 overflow-y-auto">
          {isSearchActive ? (
            <>
              {search.isLoading && (
                <p className="text-center text-sm text-text-muted py-4">Searching...</p>
              )}
              {!search.isLoading && search.results.length === 0 && (
                <p className="text-center text-sm text-text-muted py-4">No users found</p>
              )}
              {search.results.map((user) => (
                <button
                  key={user.id}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated text-left transition-colors"
                  onClick={() =>
                    createDirectChat(
                      { targetUserId: user.id },
                      { onSuccess: () => search.onChange('') },
                    )
                  }
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-primary">
                      {(user.displayName ?? user.name).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">
                      {user.displayName ?? user.name}
                    </p>
                    <p className="text-xs text-text-muted truncate">@{user.name}</p>
                  </div>
                </button>
              ))}
            </>
          ) : (
            <>
              {isLoading && <p className="text-center text-sm text-text-muted py-4">Loading...</p>}
              {!isLoading && chats.length === 0 && (
                <p className="text-center text-sm text-text-muted py-4">No chats yet</p>
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
        <UserPanel onProfileClick={() => setIsProfileOpen(true)} />
      </aside>

      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-10 p-2 bg-surface border border-border rounded-lg hover:bg-surface-elevated"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onSettingsClick={() => {
          setIsProfileOpen(false);
          setIsSettingsOpen(true);
        }}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
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
