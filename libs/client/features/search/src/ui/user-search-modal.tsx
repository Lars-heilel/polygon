import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import { useCreateDirectChatMutation } from '@org/entities-chat';
import { Avatar, Input, Modal, Text } from '@org/shared';
import { useSearchUsers } from '@org/entities-user';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface User {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export function UserSearchModal({ isOpen, onClose }: UserSearchModalProps) {
  const search = useSearchUsers();
  const { mutateAsync: createChat } = useCreateDirectChatMutation();
  const navigate = useNavigate();
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const handleSelectUser = useCallback(async (userId: string) => {
    if (creatingId) return;
    setCreatingId(userId);
    try {
      const newChat = await createChat({ targetUserId: userId });
      onClose();
      navigate(`/chats/${newChat.id}`);
    } catch {
      setCreatingId(null);
    }
  }, [createChat, onClose, navigate, creatingId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <Modal.Header title="New Chat" />
      <div className="p-4 border-b border-border">
        <Input
          value={search.inputValue}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder="Search users..."
          size="sm"
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
      </div>
      <Modal.Body className="max-h-96 p-2">
        {search.results.map((user: User) => (
          <button
            key={user.id}
            type="button"
            onClick={() => handleSelectUser(user.id)}
            disabled={creatingId === user.id}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-elevated rounded-lg transition-colors disabled:opacity-50"
          >
            <Avatar src={user.avatarUrl ?? undefined} name={user.displayName ?? user.name} size="md" />
            <div className="flex-1 text-left">
              <Text size="sm" weight="medium">{user.displayName ?? user.name}</Text>
              <Text size="xs" color="muted">@{user.name}</Text>
            </div>
            {creatingId === user.id && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </button>
        ))}
        {search.results.length === 0 && search.inputValue && (
          <Text size="sm" color="muted" className="text-center py-8">No users found</Text>
        )}
      </Modal.Body>
    </Modal>
  );
}
