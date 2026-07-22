import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useGetChatsSuspenseQuery } from '@org/entities-chat';
import {
  FileMessage,
  MessageActionsMenu,
  MessageBubble,
  MessageContent,
  useDeleteMessageMutation,
  useInfiniteMessagesQuery,
} from '@org/entities-message';
import type { Message } from '@org/entities-message';
import { useMeSuspenseQuery } from '@org/entities-user';
import type { AudioTrack, VirtualFeedHandle } from '@org/shared';
import { Button, Text, VirtualFeed, socket } from '@org/shared';

import { DeleteMessageModal } from './delete-message-modal';

interface ChatMessageRowProps {
  msg: Message;
  isMine: boolean;
  senderName?: string;
  senderAvatarUrl?: string;
  audioQueue: AudioTrack[];
  audioQueueIndexByMessageId: Map<string, number>;
  onEditMessage?: (message: Message) => void;
  onDeleteMessage?: (message: Message) => void;
}

interface VirtualMessageListProps {
  chatId: string;
  diagnosticContext?: Record<string, string | number | boolean | null>;
  onEditMessage?: (message: Message) => void;
}

export function getMessageVirtualKey(msg: Pick<Message, 'id' | 'clientId'>): string {
  return msg.clientId ? `client:${msg.clientId}` : `server:${msg.id}`;
}

export const ChatMessageRow = memo(({
  msg,
  isMine,
  senderName,
  senderAvatarUrl,
  audioQueue,
  audioQueueIndexByMessageId,
  onEditMessage,
  onDeleteMessage,
}: ChatMessageRowProps) => {
  return (
    <div
      className="px-4 pb-3"
      data-testid="message-row"
      data-message-id={msg.id}
      data-message-client-id={msg.clientId ?? undefined}
      data-message-virtual-key={getMessageVirtualKey(msg)}
      data-message-type={msg.fileCategory ?? msg.type}
    >
      <MessageBubble
        message={msg}
        isMine={isMine}
        senderName={senderName}
        senderAvatarUrl={senderAvatarUrl}
        actionsSlot={
          <MessageActionsMenu
            message={msg}
            isMine={isMine}
            onEdit={(message) => onEditMessage?.(message)}
            onForward={() => undefined}
            onDelete={(message) => onDeleteMessage?.(message)}
          />
        }
      >
        {msg.fileId ? (
          <div className="space-y-2">
            <FileMessage
              message={msg}
              isMine={isMine}
              audioQueue={audioQueue}
              audioQueueIndex={audioQueueIndexByMessageId.get(msg.id)}
            />
            {msg.text ? <MessageContent text={msg.text} isMine={isMine} /> : null}
          </div>
        ) : (
          <MessageContent text={msg.text ?? ''} isMine={isMine} />
        )}
      </MessageBubble>
    </div>
  );
});

const EmptyState = memo(() => (
  <div className="relative flex-1 h-full w-full overflow-hidden">
    <div className="h-full flex justify-center content-center items-center">
      <Text
        size="sm"
        color="muted"
      >
        No messages yet. Say hi!
      </Text>
    </div>
  </div>
));

export const VirtualMessageList = memo(function MessageList({
  chatId,
  diagnosticContext,
  onEditMessage,
}: VirtualMessageListProps) {
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMessagesQuery(chatId);
  const { data: me } = useMeSuspenseQuery();
  const { data: chats } = useGetChatsSuspenseQuery();
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [messagePendingDelete, setMessagePendingDelete] = useState<Message | null>(null);
  const isAtBottomRef = useRef(true);
  const feedRef = useRef<VirtualFeedHandle>(null);
  const deleteMessage = useDeleteMessageMutation(chatId);

  const allMessages = useMemo(
    () => [...infiniteData.pages].reverse().flatMap((p) => p.messages),
    [infiniteData.pages],
  );

  const memberProfileMap = useMemo(() => {
    const chat = chats.find((c) => c.id === chatId);
    return new Map((chat?.members ?? []).map((m) => [m.userId, m.profile]));
  }, [chats, chatId]);
  const audioQueue = useMemo(
    () => allMessages
      .filter((msg) => msg.fileCategory === 'AUDIO' && msg.fileId)
      .map((msg) => ({
        id: `audio-${msg.id}`,
        url: `/api/media/files/${msg.fileId}/content`,
        title: msg.fileName ?? 'Audio',
        subtitle: 'Audio file',
      })),
    [allMessages],
  );
  const audioQueueIndexByMessageId = useMemo(() => {
    const map = new Map<string, number>();
    let queueIndex = 0;
    for (const msg of allMessages) {
      if (msg.fileCategory === 'AUDIO' && msg.fileId) {
        map.set(msg.id, queueIndex);
        queueIndex += 1;
      }
    }
    return map;
  }, [allMessages]);

  const handleStartReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollToBottom = useCallback(() => {
    feedRef.current?.scrollToEnd('smooth');
  }, []);

  const handleAtBottomChange = useCallback((bottom: boolean) => {
    setIsAtBottom(bottom);
    isAtBottomRef.current = bottom;
  }, []);

  useEffect(() => {
    const handler = (msg: Message) => {
      if (msg.chatId !== chatId || msg.senderId !== me.id) return;

      setTimeout(() => {
        feedRef.current?.scrollToEnd('smooth');
      }, 0);
    };

    socket.on('message:new', handler);
    return () => {
      socket.off('message:new', handler);
    };
  }, [chatId, me.id]);

  if (allMessages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="relative flex-1 h-full w-full">
      <VirtualFeed
        ref={feedRef}
        diagnosticName="chat-message-list"
        diagnosticContext={diagnosticContext}
        diagnostics="always"
        mode="reverse"
        items={allMessages}
        getKey={getMessageVirtualKey}
        estimateItemHeight={80}
        hasPrevious={hasNextPage}
        isLoadingPrevious={isFetchingNextPage}
        loadPrevious={handleStartReached}
        onAtBottomChange={handleAtBottomChange}
        footer={<div className="h-6" />}
        renderItem={(msg) => {
          const profile = memberProfileMap.get(msg.senderId);
          return (
            <ChatMessageRow
              msg={msg}
              isMine={msg.senderId === me.id}
              senderName={profile?.displayName ?? profile?.name ?? undefined}
              senderAvatarUrl={profile?.avatarUrl ?? undefined}
              audioQueue={audioQueue}
              audioQueueIndexByMessageId={audioQueueIndexByMessageId}
              onEditMessage={onEditMessage}
              onDeleteMessage={setMessagePendingDelete}
            />
          );
        }}
      />

      <DeleteMessageModal
        isOpen={messagePendingDelete !== null}
        message={messagePendingDelete}
        isMine={messagePendingDelete?.senderId === me.id}
        onClose={() => setMessagePendingDelete(null)}
        onConfirm={(mode) => {
          if (!messagePendingDelete) return;
          deleteMessage.mutate(
            { messageId: messagePendingDelete.id, mode },
            { onSettled: () => setMessagePendingDelete(null) },
          );
        }}
      />

      {!isAtBottom && (
        <Button
          type="button"
          size="sm"
          className="absolute bottom-6 right-6 z-10 rounded-full shadow-[var(--shadow-popover)]"
          onClick={scrollToBottom}
          leftIcon={
            <span
              aria-hidden="true"
              className="text-base leading-none"
            >
              ↓
            </span>
          }
        >
          New messages
        </Button>
      )}
    </div>
  );
});
