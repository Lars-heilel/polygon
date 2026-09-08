import { useCallback, useState } from 'react';

import { useCreateDirectChatMutation } from '@org/entities-chat';
import { Button, Modal, Skeleton, Text } from '@org/shared';
import { useNavigate } from 'react-router';

import { useUserProfileQuery } from '../api/use-user-profile.js';
import { ProfileHeader } from './profile-header.js';
import { ProfileMediaPanel } from './profile-media-panel.js';

interface UserProfileModalProps {
  userId: string;
  chatId?: string;
  onClose: () => void;
  onAvatarClick?: () => void;
  showSendButton?: boolean;
}

export function UserProfileModal({
  userId,
  chatId,
  onClose,
  onAvatarClick,
  showSendButton,
}: UserProfileModalProps) {
  const navigate = useNavigate();
  const { data: profile, isLoading, isError } = useUserProfileQuery(userId);
  const createChat = useCreateDirectChatMutation();
  const [activeTab, setActiveTab] = useState<'profile' | 'media'>('profile');
  const [creatingChat, setCreatingChat] = useState(false);

  const handleSendMessage = useCallback(async () => {
    if (creatingChat) return;

    setCreatingChat(true);
    try {
      const newChat = await createChat.mutateAsync({ targetUserId: userId });
      onClose();
      navigate(`/chats/${newChat.id}`);
    } catch {
      setCreatingChat(false);
    }
  }, [creatingChat, createChat, navigate, onClose, userId]);

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        className="flex h-[600px] max-h-[85vh] max-w-lg flex-col"
      >
        <Modal.Header title="Profile" />

        <Modal.Body className="flex min-h-0 flex-1 flex-col p-0" scroll={activeTab !== 'media' || !chatId}>
          {isLoading ? (
            <div
              data-testid="profile-modal-loading"
              className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8"
            >
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : isError || !profile ? (
            <div className="flex h-full items-center justify-center px-6 py-8">
              <Text size="sm" color="muted">Failed to load profile</Text>
            </div>
          ) : activeTab === 'media' && chatId ? (
            <div className="h-full min-h-0 p-4">
              <ProfileMediaPanel chatId={chatId} />
            </div>
          ) : (
            <div className="h-full overflow-y-auto px-6 py-6">
              <ProfileHeader
                avatarUrl={profile.avatarUrl}
                displayName={profile.displayName ?? profile.name}
                handleName={profile.name}
                role={profile.role}
                bio={profile.bio}
                onAvatarClick={onAvatarClick ?? undefined}
                actions={showSendButton ? (
                  <Button
                    type="button"
                    loading={creatingChat}
                    onClick={handleSendMessage}
                    className="mt-3 w-full max-w-xs"
                  >
                    Send message
                  </Button>
                ) : undefined}
              />
            </div>
          )}
        </Modal.Body>

        {chatId && !isLoading && profile && (
          <Modal.Footer className="justify-stretch p-2">
            <div className="grid w-full grid-cols-2 gap-1 rounded-md border border-border bg-surface-elevated p-1">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={
                  activeTab === 'profile'
                    ? 'rounded-md bg-surface px-3 py-2 text-sm font-medium text-text shadow-sm'
                    : 'rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text'
                }
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('media')}
                className={
                  activeTab === 'media'
                    ? 'rounded-md bg-surface px-3 py-2 text-sm font-medium text-text shadow-sm'
                    : 'rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text'
                }
              >
                Media
              </button>
            </div>
          </Modal.Footer>
        )}
      </Modal>

    </>
  );
}
