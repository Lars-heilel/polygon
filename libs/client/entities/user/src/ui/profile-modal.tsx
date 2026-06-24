import { Avatar, Button, Heading, Modal, Text } from '@org/shared';

import { useMeQuery } from '../api/user.api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsClick?: () => void;
  onEditProfileClick?: () => void;
  onAvatarClick?: () => void;
}

export function ProfileModal({ isOpen, onClose, onSettingsClick, onEditProfileClick, onAvatarClick }: ProfileModalProps) {
  const { data: me } = useMeQuery();

  if (!me) return null;

  const displayName = me.displayName ?? me.name ?? me.email.slice(0, 8);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="relative">
        <div className="h-32 bg-linear-to-r from-primary to-primary/60">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/30 rounded-full transition-colors text-white"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 -bottom-16">
          <button type="button" onClick={onAvatarClick} className="group relative cursor-pointer">
            <Avatar src={me.avatarUrl ?? undefined} name={displayName} size="xl" />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center border-2 border-surface shadow-md">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      <div className="pt-20 pb-6 px-6">
        <div className="text-center mb-6">
          <Heading level={3} as="h2">{displayName}</Heading>
          <Text color="muted">{me.email}</Text>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg">
            <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">{me.email}</span>
          </div>
          {me.bio && (
            <div className="p-3 bg-surface-elevated rounded-lg">
              <Text size="sm" color="muted">{me.bio}</Text>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={onSettingsClick} className="flex-1">Settings</Button>
          <Button variant="secondary" className="flex-1" onClick={onEditProfileClick}>
            Edit Profile
          </Button>
        </div>
      </div>
    </Modal>
  );
}
