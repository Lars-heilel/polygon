import { useState } from 'react';
import { Textarea, Button } from '@org/shared';
import {
  SidebarHeader,
  ChatSearch,
  ChatItem,
  UserPanel,
  ChatHeader,
  MessageList as MessageListWidget,
  ProfileModal,
  SettingsModal,
  CreateChatModal,
} from '@org/widgets';
import {
  useChatList,
  useChatWindow,
  useCreateChat,
} from '@org/features';

export function ChatsTestPage() {
  // Бизнес-логика из features
  const {
    chats,
    isLoading: chatsLoading,
    searchQuery,
    setSearchQuery,
    selectedChatId,
    setSelectedChatId,
  } = useChatList();

  const {
    messages,
    isLoading: messagesLoading,
    currentUserId,
    messageText,
    setMessageText,
    isSending,
    handleSend,
  } = useChatWindow(selectedChatId);

  const {
    isOpen: isCreateChatOpen,
    setIsOpen: setIsCreateChatOpen,
    users,
    searchQuery: userSearchQuery,
    setSearchQuery: setUserSearchQuery,
    isCreating,
    onSelectUser,
  } = useCreateChat();

  // UI состояния
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const selectedChat = chats.find((c) => c.id === selectedChatId);

  return (
    <div className="h-screen flex bg-surface text-text font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} shrink-0 border-r border-border flex flex-col bg-surface transition-all duration-300 overflow-hidden`}>
        <SidebarHeader
          onMenuClick={() => setIsSidebarOpen(false)}
          onNewChatClick={() => setIsCreateChatOpen(true)}
        />
        <ChatSearch value={searchQuery} onChange={setSearchQuery} />
        <nav className="flex-1 overflow-y-auto">
          {chatsLoading && <p className="text-center text-sm text-text-muted py-4">Loading...</p>}
          {!chatsLoading && chats.length === 0 && (
            <p className="text-center text-sm text-text-muted py-4">No chats yet</p>
          )}
          {chats.map((chat) => (
            <ChatItem
              key={chat.id}
              {...chat}
              isActive={chat.id === selectedChatId}
              onClick={() => setSelectedChatId(chat.id)}
            />
          ))}
        </nav>
        <UserPanel onProfileClick={() => setIsProfileOpen(true)} />
      </aside>

      {/* Sidebar toggle button */}
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

      {/* CHAT WINDOW */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        {selectedChat ? (
          <>
            <ChatHeader
              name={selectedChat.name}
              online={selectedChat.online}
              onMenuClick={() => {}}
            />
            <MessageListWidget chatId={selectedChat.id} />
            <div className="px-4 py-3 border-t border-border shrink-0">
              <div className="flex gap-3 items-end">
                <button className="p-2 hover:bg-surface-elevated rounded-lg text-text-muted">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <div className="flex-1">
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Write a message..."
                    rows={1}
                    className="resize-none"
                    disabled={isSending}
                  />
                </div>
                <button className="p-2 hover:bg-surface-elevated rounded-lg text-text-muted">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || isSending}
                  size="md"
                >
                  {isSending ? '...' : 'Send'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted">Select a chat to start messaging</p>
          </div>
        )}
      </main>

      {/* MODALS */}
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
    </div>
  );
}

export default ChatsTestPage;
