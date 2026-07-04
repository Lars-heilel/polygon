import { useCallback, useState } from 'react';

import { useCreateDirectChatMutation } from '@org/entities-chat';
import { MediaPanel } from '@org/features-chat-media';
import { Avatar, Heading, Text } from '@org/shared';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { useUserProfileQuery } from '../api/use-user-profile.js';

interface UserProfileModalProps {
  userId: string;
  chatId?: string;
  onClose: () => void;
  showSendButton?: boolean;
}

export function UserProfileModal({
  userId,
  chatId,
  onClose,
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
  }, [userId, createChat, onClose, navigate, creatingChat]);

  if (!profile && !isLoading) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-background rounded-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-elevated rounded-lg text-text-muted transition"
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
          <Heading
            level={6}
            as="h2"
          >
            Profile
          </Heading>
          <div className="w-7" />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-24 h-24 rounded-full bg-surface-elevated animate-pulse" />
            <div className="h-5 w-32 bg-surface-elevated animate-pulse rounded" />
            <div className="h-4 w-24 bg-surface-elevated animate-pulse rounded" />
          </div>
        ) : isError || !profile ? (
          <div className="py-6 text-center text-text-muted text-sm">Failed to load profile</div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1">
              <div className="flex flex-col items-center gap-3 py-6 px-4">
                <Avatar
                  src={profile.avatarUrl ?? undefined}
                  name={profile.displayName ?? profile.name}
                  size="xl"
                />
                <div className="text-center">
                  <Heading
                    level={5}
                    as="h3"
                  >
                    {profile.displayName ?? profile.name}
                  </Heading>
                  <Text
                    size="xs"
                    className="text-text-muted"
                  >
                    @{profile.name}
                  </Text>
                </div>
                {profile.bio && (
                  <Text
                    size="sm"
                    className="text-text text-center max-w-xs"
                  >
                    {profile.bio}
                  </Text>
                )}
                <div className="flex items-center gap-1.5 text-text-muted text-sm py-5">
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
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{profile.email}</span>
                </div>
              </div>

              {showSendButton && (
                <div className="px-4 pb-4">
                  <button
                    onClick={handleSendMessage}
                    disabled={creatingChat}
                    className="w-full py-2 px-4 rounded-lg bg-primary hover:bg-primary/80 disabled:opacity-50 text-white text-sm font-medium transition"
                  >
                    {creatingChat ? 'Creating...' : 'Send message'}
                  </button>
                </div>
              )}

              {chatId && (
                <div className="border-t border-border">
                  <div className="flex border-b border-border">
                    <button
                      onClick={() => setActiveTab('profile')}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === 'profile'
                          ? 'text-primary border-b-2 border-primary'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => setActiveTab('media')}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === 'media'
                          ? 'text-primary border-b-2 border-primary'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      Media
                    </button>
                  </div>
                  <div className="p-0">
                    {activeTab === 'media' && chatId && <MediaPanel chatId={chatId} />}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
