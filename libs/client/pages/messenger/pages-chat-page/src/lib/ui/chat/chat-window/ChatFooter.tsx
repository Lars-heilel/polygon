import { memo, useCallback } from 'react';

import { EmojiPicker } from '@org/features-emoji';
import { useSendMessage } from '@org/features-send-message';
import { Button, Textarea, showComingSoonToast } from '@org/shared';

interface ChatFooterProps {
  chatId: string;
}

export const ChatFooter = memo(function ChatFooter({ chatId }: ChatFooterProps) {
  const { messageText, setMessageText, handleSend } = useSendMessage(chatId);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleEmojiSelect = useCallback(
    ({ native }: { native: string }) => {
      setMessageText((prev) => prev + native);
    },
    [setMessageText],
  );

  return (
    <div className="px-4 py-3 border-t border-border sticky shrink-0 bg-background">
      <div className="flex gap-3 items-end">
        <button onClick={showComingSoonToast} className="p-2 hover:bg-surface-elevated rounded-lg text-text-muted transition-colors">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>

        <div className="flex-1">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            className="resize-none"
          />
        </div>

        <EmojiPicker onSelect={handleEmojiSelect} />

        <Button
          onClick={handleSend}
          disabled={!messageText.trim()}
          size="md"
        >
          Send
        </Button>
      </div>
    </div>
  );
});
