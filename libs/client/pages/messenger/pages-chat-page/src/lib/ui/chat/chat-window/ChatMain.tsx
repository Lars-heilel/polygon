import { Suspense, memo, useEffect, useMemo } from 'react';

import { MessageListSkeleton } from '@org/entities-message';
import { useChatSocket } from '@org/features-chat-socket';
import { ErrorBoundary } from '@org/shared';

import { VirtualMessageList } from '../message-list/virtual-message-list';
import { getChatDiagnosticKey, logChatSelected, logChatViewUnmounted } from './chat-diagnostics';

interface ChatMainProps {
  chatId: string;
}

export const ChatMain = memo(function ChatMain({ chatId }: ChatMainProps) {
  useChatSocket(chatId);
  const chatDiagnosticKey = getChatDiagnosticKey(chatId);
  const diagnosticContext = useMemo(
    () => ({ chatKey: chatDiagnosticKey }),
    [chatDiagnosticKey],
  );

  useEffect(() => {
    logChatSelected(chatId);

    return () => {
      logChatViewUnmounted(chatDiagnosticKey);
    };
  }, [chatDiagnosticKey, chatId]);

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
          <VirtualMessageList
            key={chatDiagnosticKey}
            chatId={chatId}
            diagnosticContext={diagnosticContext}
          />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
});
