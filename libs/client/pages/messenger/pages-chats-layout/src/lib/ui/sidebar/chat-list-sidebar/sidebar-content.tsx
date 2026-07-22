import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import { ChatItem } from '@org/entities-chat';
import { useMeQuery, useSearchUsers } from '@org/entities-user';

import { UserProfileModal } from '@org/features-user-profile';
import { Avatar, Badge, IconButton, Input, Spinner, Text } from '@org/shared';

import { useChatList } from '@org/entities-chat';
import { useCreateChat, CreateChatModal } from '@org/features-create-chat';
import { SidebarHeader } from '../sidebar-header';

interface SidebarContentProps {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
  onMenuClick: () => void;
}

export function SidebarContent({
  selectedChatId,
  onSelectChat,
  onMenuClick,
}: SidebarContentProps) {
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

  const handleSelectUser = useCallback((userId: string) => {
    setProfileUserId(userId);
  }, []);

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

  const displayName = me?.displayName ?? me?.name ?? me?.email.slice(0, 8) ?? '';

  return (
    <>
      <SidebarHeader onMenuClick={onMenuClick} />
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
                onClick={() => handleSelectUser(user.id)}
              >
                <Avatar
                  src={user.avatarUrl ?? undefined}
                  name={user.displayName ?? user.name}
                  size="sm"
                />
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

      <div className="border-t border-border p-3 flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate('/chats/profile')}
          className="flex items-center gap-2 p-2 hover:bg-surface-elevated rounded-lg transition-colors flex-1"
        >
          <Avatar src={me?.avatarUrl ?? undefined} name={displayName} size="sm" />
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Text size="sm" weight="medium" className="truncate">
              {displayName}
            </Text>
            {me?.role === 'CREATOR' && (
              <Badge
                variant="warning"
                size="sm"
                className="shrink-0 text-[10px]"
              >
                Creator
              </Badge>
            )}
          </div>
        </button>
        <IconButton
          type="button"
          label="Settings"
          size="md"
          variant="ghost"
          onClick={() => navigate('/chats/settings')}
          icon={<SettingsIcon />}
        />
      </div>

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
          onClose={() => setProfileUserId(null)}
          showSendButton
        />
      )}
    </>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
