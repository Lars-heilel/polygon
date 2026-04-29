import { Suspense, memo } from 'react';

import { MessageListSkeleton } from '@org/entities';
import { useChatSocket } from '@org/features';
import { ErrorBoundary } from '@org/shared';

import { VirtualMessageList } from '../message-list/virtual-message-list';

interface ChatMainProps {
  chatId: string;
}

export const ChatMain = memo(function ChatMain({ chatId }: ChatMainProps) {
  useChatSocket(chatId);

  return (
    <main className="flex-1 min-h-0 relative">
      <ErrorBoundary
        fallback={
          <div className="flex h-full items-center justify-center text-text-muted text-sm">
            Failed to load messages
          </div>
        }
      >
        <Suspense fallback={<MessageListSkeleton />}>
          <VirtualMessageList chatId={chatId} />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
});
