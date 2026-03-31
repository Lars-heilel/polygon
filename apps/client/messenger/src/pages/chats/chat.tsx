import { ChatWindow } from '@org/widgets';
import { useParams } from 'react-router';

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();

  if (!chatId) return null;

  return <ChatWindow chatId={chatId} />;
}
