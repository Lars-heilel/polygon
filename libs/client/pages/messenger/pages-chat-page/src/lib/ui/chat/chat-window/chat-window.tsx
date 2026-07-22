import { Suspense } from 'react';

import { ErrorBoundary, GlobalAudioPlayer } from '@org/shared';

import { ChatHeader, ChatHeaderSkeleton } from '../chat-header';
import { ChatFooter } from './ChatFooter';
import { ChatMain } from './ChatMain';

interface ChatWindowProps {
  chatId: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <GlobalAudioPlayer mode="embedded" />

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
