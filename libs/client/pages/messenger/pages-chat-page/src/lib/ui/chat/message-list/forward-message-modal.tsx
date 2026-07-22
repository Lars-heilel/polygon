import { useMemo, useState } from 'react';

import {
  type Chat,
  getChatDisplayName,
  useCreateDirectChatMutation,
  useCreateSelfChatMutation,
  useGetChatsQuery,
} from '@org/entities-chat';
import type { Message } from '@org/entities-message';
import { useForwardMessagesMutation } from '@org/entities-message';
import { useSearchUsersQuery } from '@org/entities-user';
import { Avatar, Input, Modal, Text } from '@org/shared';

interface ForwardMessageModalProps {
  isOpen: boolean;
  sourceChatId: string;
  currentUserId: string;
  message: Message | null;
  senderName?: string;
  sourceChatTitle?: string;
  onClose: () => void;
}

export function ForwardMessageModal({
  isOpen,
  sourceChatId,
  currentUserId,
  message,
  senderName,
  sourceChatTitle,
  onClose,
}: ForwardMessageModalProps) {
  const [query, setQuery] = useState('');
  const chats = useGetChatsQuery();
  const users = useSearchUsersQuery(query);
  const createSelfChat = useCreateSelfChatMutation();
  const createDirectChat = useCreateDirectChatMutation();
  const forwardMessages = useForwardMessagesMutation();

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const existingSelfChat = useMemo(() => {
    return (chats.data ?? []).find((chat) => isSelfChat(chat, currentUserId)) ?? null;
  }, [chats.data, currentUserId]);
  const chatTargets = useMemo(() => {
    return (chats.data ?? [])
      .filter((chat) => chat.id !== sourceChatId)
      .filter((chat) => !isSelfChat(chat, currentUserId))
      .filter((chat) => {
        if (!normalizedQuery) return true;
        return getChatDisplayName(chat, currentUserId)
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      });
  }, [chats.data, currentUserId, normalizedQuery, sourceChatId]);
  const existingDirectUserIds = useMemo(() => {
    return new Set(
      (chats.data ?? [])
        .filter((chat) => chat.type === 'DIRECT')
        .map((chat) => getDirectPeerId(chat, currentUserId))
        .filter((id): id is string => Boolean(id)),
    );
  }, [chats.data, currentUserId]);
  const userTargets = useMemo(() => {
    return (users.data ?? []).filter(
      (user) => user.id !== currentUserId && !existingDirectUserIds.has(user.id),
    );
  }, [currentUserId, existingDirectUserIds, users.data]);

  if (!message) return null;

  const forwardToChat = (targetChatId: string) => {
    forwardMessages.mutate(
      { targetChatId, input: { sourceChatId, messageIds: [message.id] } },
      { onSuccess: onClose },
    );
  };

  const handleSavedMessages = () => {
    if (existingSelfChat) {
      forwardToChat(existingSelfChat.id);
      return;
    }

    createSelfChat.mutate(undefined, {
      onSuccess: (chat) => forwardToChat(chat.id),
    });
  };

  const handleUser = (userId: string) => {
    createDirectChat.mutate(
      { targetUserId: userId },
      { onSuccess: (chat) => forwardToChat(chat.id) },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-sm">
      <Modal.Header title="Forward to..." />
      <Modal.Body className="p-0">
        <div className="space-y-3 border-b border-border p-3">
          <Input
            aria-label="Search forward targets"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
          />
          <ForwardMessagePreview
            message={message}
            senderName={senderName}
            sourceChatTitle={sourceChatTitle}
            currentUserId={currentUserId}
          />
        </div>
        <div className="max-h-[70vh] overflow-y-auto py-1">
          <ForwardTargetRow
            title="Saved Messages"
            subtitle="Forward messages here for quick access"
            initials="S"
            onClick={handleSavedMessages}
          />
          {chatTargets.map((chat) => {
            const title = getChatDisplayName(chat, currentUserId);
            return (
              <ForwardTargetRow
                key={chat.id}
                title={title}
                subtitle={chat.type === 'GROUP' ? 'group' : 'chat'}
                initials={title.slice(0, 2)}
                onClick={() => forwardToChat(chat.id)}
              />
            );
          })}
          {userTargets.map((user) => {
            const title = user.displayName ?? user.name;
            return (
              <ForwardTargetRow
                key={user.id}
                title={title}
                subtitle="user"
                initials={title.slice(0, 2)}
                onClick={() => handleUser(user.id)}
              />
            );
          })}
          {normalizedQuery && chatTargets.length === 0 && userTargets.length === 0 ? (
            <Text size="sm" color="muted" className="px-4 py-6 text-center">
              No chats or users found
            </Text>
          ) : null}
        </div>
      </Modal.Body>
    </Modal>
  );
}

function isSelfChat(chat: Chat, currentUserId: string): boolean {
  if (chat.selfOwnerId === currentUserId) return true;
  return chat.type === 'DIRECT'
    && chat.members.length === 1
    && chat.members[0]?.userId === currentUserId;
}

function getDirectPeerId(chat: Chat, currentUserId: string): string | null {
  return chat.members.find((member) => member.userId !== currentUserId)?.userId ?? null;
}

function getMessagePreview(message: Message): string {
  if (message.text?.trim()) return message.text.trim();
  if (message.fileName) return message.fileName;
  if (message.fileCategory) return `${message.fileCategory.toLocaleLowerCase()} message`;
  return 'Message';
}

function ForwardMessagePreview({
  message,
  senderName,
  sourceChatTitle,
  currentUserId,
}: {
  message: Message;
  senderName?: string;
  sourceChatTitle?: string;
  currentUserId: string;
}) {
  const author = message.senderId === currentUserId ? 'You' : senderName ?? 'Unknown sender';
  const preview = getMessagePreview(message);

  return (
    <div className="rounded-md border border-border bg-surface-elevated px-3 py-2">
      <Text size="xs" color="muted" className="truncate">
        Forwarding from {author}{sourceChatTitle ? ` in ${sourceChatTitle}` : ''}
      </Text>
      <Text size="sm" className="mt-1 line-clamp-2 break-words">
        {preview}
      </Text>
    </div>
  );
}

function ForwardTargetRow({
  title,
  subtitle,
  initials,
  onClick,
}: {
  title: string;
  subtitle: string;
  initials: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="forward-target-row"
      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-elevated"
      onClick={onClick}
    >
      <Avatar name={initials} size="sm" />
      <span className="min-w-0 flex-1">
        <Text as="span" size="sm" weight="medium" className="block truncate">
          {title}
        </Text>
        <Text as="span" size="xs" color="muted" className="block truncate">
          {subtitle}
        </Text>
      </span>
    </button>
  );
}
