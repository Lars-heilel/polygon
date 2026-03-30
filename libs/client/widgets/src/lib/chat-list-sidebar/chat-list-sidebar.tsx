import { useState } from 'react';
import { SidebarHeader, ChatSearch, ChatItem, UserPanel, ProfileModal, SettingsModal, CreateChatModal } from '@org/widgets';
import { useChatList, useCreateChat } from '@org/features';

interface ChatListSidebarProps {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
}

export function ChatListSidebar({ selectedChatId, onSelectChat }: ChatListSidebarProps) {
  const {
    chats,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedChatId: internalSelectedChatId,
    setSelectedChatId,
  } = useChatList();

  const {
    isOpen: isCreateChatOpen,
    setIsOpen: setIsCreateChatOpen,
    users,
    searchQuery: userSearchQuery,
    setSearchQuery: setUserSearchQuery,
    isCreating,
    onSelectUser,
  } = useCreateChat();

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
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} shrink-0 border-r border-border flex flex-col bg-surface transition-all duration-300 overflow-hidden`}>
        <SidebarHeader
          onMenuClick={() => setIsSidebarOpen(false)}
          onNewChatClick={() => setIsCreateChatOpen(true)}
        />
        <ChatSearch value={searchQuery} onChange={setSearchQuery} />
        <nav className="flex-1 overflow-y-auto">
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
        </nav>
        <UserPanel onProfileClick={() => setIsProfileOpen(true)} />
      </aside>

      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-10 p-2 bg-surface border border-border rounded-lg hover:bg-surface-elevated"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Modals */}
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
