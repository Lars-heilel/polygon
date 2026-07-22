import { useCallback, useState } from 'react';

import { useCreateDirectChatMutation } from '@org/entities-chat';
import { Avatar, Badge, Button, Heading, Modal, Skeleton, Text } from '@org/shared';
import { useNavigate } from 'react-router';

import { useUserProfileQuery } from '../api/use-user-profile.js';
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

        <Modal.Body className="min-h-0 flex-1 p-0">
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
            <div className="flex h-full flex-col items-center gap-3 overflow-y-auto px-6 py-6">
              {onAvatarClick ? (
                <button
                  type="button"
                  aria-label="Open avatar history"
                  onClick={onAvatarClick}
                  className="shrink-0 rounded-full"
                >
                  <Avatar
                    src={profile.avatarUrl ?? undefined}
                    name={profile.displayName ?? profile.name}
                    size="xl"
                    className="ring-2 ring-border"
                  />
                </button>
              ) : (
                <Avatar
                  src={profile.avatarUrl ?? undefined}
                  name={profile.displayName ?? profile.name}
                  size="xl"
                  className="shrink-0 ring-2 ring-border"
                />
              )}

              <div className="text-center">
                <Heading level={5} as="h3" className="flex items-center justify-center gap-2">
                  {profile.displayName ?? profile.name}
                  {profile.role === 'CREATOR' && <Badge variant="warning">Creator</Badge>}
                </Heading>
                <Text size="xs" color="muted">@{profile.name}</Text>
              </div>

              {profile.bio && (
                <Text size="sm" className="max-w-xs break-words text-center">
                  {profile.bio}
                </Text>
              )}

              <div className="mt-3 w-full max-w-xs rounded-md border border-border bg-surface-elevated px-4 py-2 text-center">
                <Text size="sm" color="muted" className="break-all">
                  {profile.email}
                </Text>
              </div>

              {showSendButton && (
                <Button
                  type="button"
                  loading={creatingChat}
                  onClick={handleSendMessage}
                  className="mt-auto w-full max-w-xs"
                >
                  Send message
                </Button>
              )}
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
