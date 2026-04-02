import { Avatar, Input, Modal } from '@org/shared';

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
}

export function CreateChatModal({
  isOpen,
  onClose,
  users,
  searchQuery,
  onSearchChange,
  onSelectUser,
  isCreating = false,
}: CreateChatModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-md"
    >
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-bold">New Chat</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-surface-elevated rounded-lg"
          disabled={isCreating}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

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

      <div className="max-h-96 overflow-y-auto p-2">
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => onSelectUser(user.id)}
            disabled={isCreating}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-elevated rounded-lg transition-colors disabled:opacity-50"
          >
            <div className="relative">
              <Avatar
                name={user.displayName ?? user.name}
                size="md"
              />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{user.displayName ?? user.name}</p>
              <p className="text-xs text-text-muted">@{user.name}</p>
            </div>
          </button>
        ))}

        {users.length === 0 && searchQuery && (
          <p className="text-center text-sm text-text-muted py-8">No users found</p>
        )}
      </div>
    </Modal>
  );
}
