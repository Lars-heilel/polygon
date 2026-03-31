import { useState } from 'react';

import { ChatListSidebar } from '@org/widgets';
import { Outlet, useNavigate } from 'react-router';

export function ChatsLayout() {
  const navigate = useNavigate();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    navigate(`/chats/${chatId}`);
  };

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
