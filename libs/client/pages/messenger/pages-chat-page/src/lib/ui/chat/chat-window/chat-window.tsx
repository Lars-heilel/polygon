import { Suspense } from 'react';

import { ChatHeader, ChatHeaderSkeleton } from '@org/entities-chat';
import { ErrorBoundary } from '@org/shared';

import { ChatFooter } from './ChatFooter';
import { ChatMain } from './ChatMain';

interface ChatWindowProps {
  chatId: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <header className="shrink-0">
        <ErrorBoundary fallback={<ChatHeaderSkeleton />}>
          <Suspense fallback={<ChatHeaderSkeleton />}>
            <ChatHeader chatId={chatId} />
          </Suspense>
        </ErrorBoundary>
      </header>

      <ChatMain chatId={chatId} />

      <ChatFooter chatId={chatId} />
    </div>
  );
}
