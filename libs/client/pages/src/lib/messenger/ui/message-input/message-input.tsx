import { SendMessageForm } from '../send-message-form/send-message-form';

interface MessageInputProps {
  chatId: string;
}

export function MessageInput({ chatId }: MessageInputProps) {
  return (
    <div className="px-4 py-3 border-t border-border shrink-0">
      <SendMessageForm chatId={chatId} />
    </div>
  );
}
