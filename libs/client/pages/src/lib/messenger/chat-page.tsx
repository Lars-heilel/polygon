import { useParams } from 'react-router';

import { ChatWindow } from './ui/chat-window';

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();

  if (!chatId) return null;

  return <ChatWindow chatId={chatId} />;
}
