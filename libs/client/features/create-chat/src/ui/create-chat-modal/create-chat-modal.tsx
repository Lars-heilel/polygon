import { Avatar, Input, Modal, Text, Toggle } from '@org/shared';

interface User {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectUser: (userId: string) => void;
  isCreating?: boolean;
  e2eeEnabled: boolean;
  onE2eeChange: (enabled: boolean) => void;
}

export function CreateChatModal({
  isOpen,
  onClose,
  users,
  searchQuery,
  onSearchChange,
  onSelectUser,
  isCreating = false,
  e2eeEnabled,
  onE2eeChange,
}: CreateChatModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-md"
    >
      <Modal.Header title="New Chat" />

      <div className="p-4 border-b border-border">
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search users..."
          size="sm"
          disabled={isCreating}
          leftIcon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          }
        />
      </div>

      <Modal.Body className="max-h-96 p-2">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex-1">
            <Text
              size="sm"
              weight="medium"
            >
              End-to-end encryption
            </Text>
            <Text
              size="xs"
              color="muted"
            >
              Only you and the other person can read messages
            </Text>
          </div>
          <Toggle
            checked={e2eeEnabled}
            onChange={onE2eeChange}
            disabled={isCreating}
            aria-label="End-to-end encryption"
          />
        </div>

        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelectUser(user.id)}
            disabled={isCreating}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-elevated rounded-lg transition-colors disabled:opacity-50"
          >
            <Avatar
              src={user.avatarUrl ?? undefined}
              name={user.displayName ?? user.name}
              size="md"
            />
            <div className="flex-1 text-left">
              <Text
                size="sm"
                weight="medium"
              >
                {user.displayName ?? user.name}
              </Text>
              <Text
                size="xs"
                color="muted"
              >
                @{user.name}
              </Text>
            </div>
          </button>
        ))}

        {users.length === 0 && searchQuery && (
          <Text
            size="sm"
            color="muted"
            className="text-center py-8"
          >
            No users found
          </Text>
        )}
      </Modal.Body>
    </Modal>
  );
}
