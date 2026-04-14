import { Suspense, useCallback } from 'react';

import { Button, ErrorBoundary, Textarea } from '@org/shared';

import { useChatWindow } from '../../model/use-chat-window';
import { ChatHeader, ChatHeaderSkeleton } from '../chat-header';
import { MessageList, MessageListSkeleton } from '../message-list';

interface ChatWindowProps {
  chatId: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  const { messageText, setMessageText, isSending, handleSend } = useChatWindow(chatId);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex flex-col h-full">
      <ErrorBoundary fallback={<ChatHeaderSkeleton />}>
        <Suspense fallback={<ChatHeaderSkeleton />}>
          <ChatHeader chatId={chatId} />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary
        fallback={
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            Failed to load messages
          </div>
        }
      >
        <Suspense fallback={<MessageListSkeleton />}>
          <MessageList chatId={chatId} />
        </Suspense>
      </ErrorBoundary>

      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex gap-3 items-end">
          <button className="p-2 hover:bg-surface-elevated rounded-lg text-text-muted">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              disabled={isSending}
            />
          </div>
          <button className="p-2 hover:bg-surface-elevated rounded-lg text-text-muted">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || isSending}
            size="md"
          >
            {isSending ? '...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
