import { type KeyboardEvent } from 'react';
import { Textarea, Button } from '@org/shared';
import { useSendMessage } from '../model/use-send-message';

interface SendMessageFormProps {
  chatId: string;
}

export function SendMessageForm({ chatId }: SendMessageFormProps) {
  const { text, setText, send, isSending } = useSendMessage(chatId);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          maxChars={4000}
          disabled={isSending}
        />
      </div>
      <Button onClick={send} disabled={!text.trim() || isSending} size="md">
        Send
      </Button>
    </div>
  );
}
