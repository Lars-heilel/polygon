import { Suspense, useState } from 'react';

import { ErrorBoundary, Text } from '@org/shared';

import { SidebarContent } from './sidebar-content';
import { SidebarSkeleton } from './sidebar-skeleton';

interface ChatListSidebarProps {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatListSidebar({ selectedChatId, onSelectChat, isSidebarOpen: controlledOpen, onToggleSidebar }: ChatListSidebarProps) {
  const [localOpen, setLocalOpen] = useState(true);

  const isSidebarOpen = controlledOpen != null ? controlledOpen : localOpen;
  const toggleSidebar = onToggleSidebar ?? (() => setLocalOpen((v) => !v));

  return (
    <aside
      className={`${isSidebarOpen ? 'w-80' : 'w-0'} shrink-0 border-r border-border flex flex-col bg-surface transition-all duration-300 overflow-hidden`}
    >
      <ErrorBoundary
        fallback={
          <Text size="sm" color="muted" className="text-center py-8">
            Failed to load chats
          </Text>
        }
      >
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarContent
            selectedChatId={selectedChatId}
            onSelectChat={onSelectChat}
            onMenuClick={() => toggleSidebar()}
          />
        </Suspense>
      </ErrorBoundary>
    </aside>
  );
}
