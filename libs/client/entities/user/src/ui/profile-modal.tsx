import { Avatar, Button, Heading, Modal, Text } from '@org/shared';

import { useMeQuery } from '../api/user.api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsClick?: () => void;
}

export function ProfileModal({ isOpen, onClose, onSettingsClick }: ProfileModalProps) {
  const { data: me } = useMeQuery();

  if (!me) return null;

  const displayName = me.name ?? me.email.slice(0, 8);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-md"
    >
      <Modal.Header>
        <div className="relative h-32 bg-linear-to-r from-primary to-primary/60">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/30 rounded-full transition-colors text-white"
            aria-label="Close"
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
      </Modal.Header>

      <div className="absolute left-1/2 -translate-x-1/2 -top-16">
        <Avatar
          name={displayName}
          size="xl"
        />
      </div>

      <div className="pt-20 pb-6 px-6">
        <div className="text-center mb-6">
          <Heading
            level={3}
            as="h2"
          >
            {displayName}
          </Heading>
          <Text color="muted">{me.email}</Text>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg">
            <svg
              className="w-5 h-5 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm">{me.email}</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            onClick={onSettingsClick}
            className="flex-1"
          >
            Settings
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
          >
            Edit Profile
          </Button>
        </div>
      </div>
    </Modal>
  );
}
