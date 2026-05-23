import { useCallback, useState } from 'react';

import { Outlet, useNavigate } from 'react-router';

import { useMessageNotification } from '@org/features-notifications';
import { SidebarLayout } from '@org/layouts-sidebar';

import { ChatListSidebar } from './ui/sidebar';

export function ChatsLayout() {
  useMessageNotification();

  const navigate = useNavigate();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      setSelectedChatId(chatId);
      navigate(`/chats/${chatId}`);
    },
    [navigate],
  );

  return (
    <SidebarLayout
      sidebar={
        <ChatListSidebar
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
        />
      }
    >
      <Outlet />
    </SidebarLayout>
  );
}
