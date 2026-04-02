import type { UserSearchResult } from '@org/common';
import { Avatar, Input, Modal, Spinner } from '@org/shared';

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserSearchResult[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectUser: (userId: string) => void;
  isCreating?: boolean;
  isSearching?: boolean;
}

export function CreateChatModal({
  isOpen,
  onClose,
  users,
  searchQuery,
  onSearchChange,
  onSelectUser,
  isCreating = false,
  isSearching = false,
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
          placeholder="Search by username..."
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
        {isSearching && (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        )}

        {!isSearching &&
          users.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user.id)}
              disabled={isCreating}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-elevated rounded-lg transition-colors disabled:opacity-50"
            >
              <Avatar
                name={user.displayName ?? user.name}
                src={user.avatarUrl ?? undefined}
                size="md"
              />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{user.displayName ?? user.name}</p>
                <p className="text-xs text-text-muted">@{user.name}</p>
              </div>
            </button>
          ))}

        {!isSearching && users.length === 0 && searchQuery.trim().length >= 2 && (
          <p className="text-center text-sm text-text-muted py-8">No users found</p>
        )}

        {!isSearching && searchQuery.trim().length < 2 && (
          <p className="text-center text-sm text-text-muted py-8">
            Type at least 2 characters to search
          </p>
        )}
      </div>
    </Modal>
  );
}
