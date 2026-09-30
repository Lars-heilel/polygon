import { useCallback, useEffect, useState } from 'react';

import { CLIENT_ROUTES } from '@org/common';
import { useMessageNotification } from '@org/features-notifications';
import { MobileLayout } from '@org/layouts-mobile';
import { SidebarLayout } from '@org/layouts-sidebar';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { ChatsTab } from './chats-tab';
import { ChatListSidebar } from './ui/sidebar';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

export function ChatsLayout() {
  useMessageNotification();

  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [_isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      setSelectedChatId(chatId);
      navigate(CLIENT_ROUTES.chats.byId(chatId));
    },
    [navigate],
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const isIndexRoute = location.pathname === CLIENT_ROUTES.chats.root;

  if (isMobile) {
    return <MobileLayout>{isIndexRoute ? <ChatsTab /> : <Outlet />}</MobileLayout>;
  }

  return (
    <SidebarLayout
      sidebar={
        <ChatListSidebar
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          isSidebarOpen
          onToggleSidebar={toggleSidebar}
        />
      }
      sidebarOpen
    >
      <Outlet />
    </SidebarLayout>
  );
}
