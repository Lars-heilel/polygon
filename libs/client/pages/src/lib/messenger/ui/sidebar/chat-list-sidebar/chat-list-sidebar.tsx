import { Suspense, useCallback, useState } from 'react';

import { useCreateDirectChatMutation } from '@org/entities';
import { useSearchUsers } from '@org/features';
import { ChatItemSkeleton, ErrorBoundary, Spinner, Text } from '@org/shared';

import { useChatList } from '../../../model/use-chat-list';
import { useCreateChat } from '../../../model/use-create-chat';
import { CreateChatModal } from '../../modals/create-chat-modal';
import { ProfileModal } from '../../modals/profile-modal';
import { SettingsModal } from '../../modals/settings-modal';
import { ChatItem } from '../chat-item';
import { ChatSearch } from '../chat-search';
import { SidebarHeader } from '../sidebar-header';
import { UserPanel } from '../user-panel';

interface ChatListSidebarProps {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
}

interface SidebarContentProps extends ChatListSidebarProps {
  onMenuClick: () => void;
  onProfileClick: () => void;
}

function SidebarContent({
  selectedChatId,
  onSelectChat,
  onMenuClick,
  onProfileClick,
}: SidebarContentProps) {
  const { chats, selectedChatId: internalSelectedChatId, setSelectedChatId } = useChatList();

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

  const handleCreateDirectChat = useCallback(
    (userId: string) => {
      createDirectChat({ targetUserId: userId }, { onSuccess: () => search.onChange('') });
    },
    [createDirectChat, search],
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
                onClick={() => handleCreateDirectChat(user.id)}
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

      <UserPanel onProfileClick={onProfileClick} />

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

function SidebarSkeleton() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="h-14.25 border-b border-border" />
      <div className="h-12 border-b border-border" />
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <ChatItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ChatListSidebar({ selectedChatId, onSelectChat }: ChatListSidebarProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <aside
        className={`${isSidebarOpen ? 'w-80' : 'w-0'} shrink-0 border-r border-border flex flex-col bg-surface transition-all duration-300 overflow-hidden`}
      >
        <ErrorBoundary
          fallback={
            <Text
              size="sm"
              color="muted"
              className="text-center py-8"
            >
              Failed to load chats
            </Text>
          }
        >
          <Suspense fallback={<SidebarSkeleton />}>
            <SidebarContent
              selectedChatId={selectedChatId}
              onSelectChat={onSelectChat}
              onMenuClick={() => setIsSidebarOpen(false)}
              onProfileClick={() => setIsProfileOpen(true)}
            />
          </Suspense>
        </ErrorBoundary>
      </aside>

      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open sidebar"
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
    </>
  );
}
