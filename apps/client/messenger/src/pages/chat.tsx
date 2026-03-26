import { useParams } from 'react-router';

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();

  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-text-muted">Chat {chatId}</p>
    </div>
  );
}
