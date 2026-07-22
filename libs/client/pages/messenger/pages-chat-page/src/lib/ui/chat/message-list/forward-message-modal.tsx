import { useMemo, useState } from 'react';

import {
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
  onClose: () => void;
}

export function ForwardMessageModal({
  isOpen,
  sourceChatId,
  currentUserId,
  message,
  onClose,
}: ForwardMessageModalProps) {
  const [query, setQuery] = useState('');
  const chats = useGetChatsQuery();
  const users = useSearchUsersQuery(query);
  const createSelfChat = useCreateSelfChatMutation();
  const createDirectChat = useCreateDirectChatMutation();
  const forwardMessages = useForwardMessagesMutation();

  const chatTargets = useMemo(
    () => (chats.data ?? []).filter((chat) => chat.id !== sourceChatId),
    [chats.data, sourceChatId],
  );

  if (!message) return null;

  const forwardToChat = (targetChatId: string) => {
    forwardMessages.mutate(
      { targetChatId, input: { sourceChatId, messageIds: [message.id] } },
      { onSuccess: onClose },
    );
  };

  const handleSavedMessages = () => {
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
        <div className="border-b border-border p-3">
          <Input
            aria-label="Search forward targets"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
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
          {(users.data ?? [])
            .filter((user) => user.id !== currentUserId)
            .map((user) => {
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
        </div>
      </Modal.Body>
    </Modal>
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
