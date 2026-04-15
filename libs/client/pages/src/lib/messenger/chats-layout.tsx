import { useCallback, useState } from 'react';

import { Outlet, useNavigate } from 'react-router';

import { ChatListSidebar } from './ui/sidebar';

export function ChatsLayout() {
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
    <div className="h-screen flex bg-surface text-text font-sans overflow-hidden">
      <ChatListSidebar
        selectedChatId={selectedChatId}
        onSelectChat={handleSelectChat}
      />
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        <Outlet />
      </main>
    </div>
  );
}
