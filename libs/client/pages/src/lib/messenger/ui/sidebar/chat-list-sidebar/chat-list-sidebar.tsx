import { Suspense, useState } from 'react';

import { ErrorBoundary, Text } from '@org/shared';

import { ProfileModal } from '@org/entities';
import { SettingsModal } from '../../modals/settings-modal';
import { SidebarContent } from './sidebar-content';
import { SidebarSkeleton } from './sidebar-skeleton';

interface ChatListSidebarProps {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
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
