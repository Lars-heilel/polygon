import { Suspense, useState } from 'react';

import type { Message } from '@org/entities-message';
import { ErrorBoundary, GlobalAudioPlayer } from '@org/shared';

import { ChatHeader, ChatHeaderSkeleton } from '../chat-header';
import { ChatFooter } from './ChatFooter';
import { ChatMain } from './ChatMain';

interface ChatWindowProps {
  chatId: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

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

      <ChatMain chatId={chatId} onEditMessage={setEditingMessage} />

      <ChatFooter
        chatId={chatId}
        editingMessage={editingMessage}
        onEditCancel={() => setEditingMessage(null)}
        onEditSaved={() => setEditingMessage(null)}
      />
    </div>
  );
}
