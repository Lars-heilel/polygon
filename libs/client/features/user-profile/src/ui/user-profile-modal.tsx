import { useCallback, useState } from 'react';

import { useCreateDirectChatMutation } from '@org/entities-chat';
import { AvatarCarousel } from '@org/features-upload-avatar';
import { Avatar, Badge, Heading, Text } from '@org/shared';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { useUserProfileQuery } from '../api/use-user-profile.js';
import { ProfileMediaPanel } from './profile-media-panel.js';

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
  const [avatarHistoryOpen, setAvatarHistoryOpen] = useState(false);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden h-[600px] max-h-[85vh] flex flex-col animate-message-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-elevated rounded-lg text-text-muted hover:text-text transition-colors"
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
            className="font-semibold text-text"
          >
            Profile
          </Heading>
          <div className="w-8" />
        </div>

        {/* Контентная зона */}
        <div className="flex-1 min-h-0 flex flex-col">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-8 flex-1 justify-center">
              <div className="w-24 h-24 rounded-full bg-surface-elevated animate-pulse" />
              <div className="h-5 w-32 bg-surface-elevated animate-pulse rounded" />
              <div className="h-4 w-24 bg-surface-elevated animate-pulse rounded" />
            </div>
          ) : isError || !profile ? (
            <div className="py-8 text-center text-text-muted text-sm flex-1 flex items-center justify-center">
              Failed to load profile
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Вкладка Профиля */}
              {activeTab === 'profile' && (
                <div className="overflow-y-auto flex-1 flex flex-col items-center gap-3 py-6 px-5 animate-fade-in custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => setAvatarHistoryOpen(true)}
                    className="shrink-0"
                  >
                    <Avatar
                      src={profile.avatarUrl ?? undefined}
                      name={profile.displayName ?? profile.name}
                      size="xl"
                      className="ring-4 ring-primary/10 shrink-0 transition-transform hover:scale-[1.02]"
                    />
                  </button>
                  <div className="text-center">
                    <Heading
                      level={5}
                      as="h3"
                      className="text-text font-bold flex items-center justify-center gap-2"
                    >
                      {profile.displayName ?? profile.name}
                      {profile.role === 'CREATOR' && (
                        <Badge
                          variant="primary"
                          size="md"
                          className="bg-gradient-to-r from-yellow-500 to-orange-500 border-0"
                        >
                          Creator
                        </Badge>
                      )}
                    </Heading>
                    <Text
                      size="xs"
                      className="text-text-muted mt-0.5"
                    >
                      @{profile.name}
                    </Text>
                  </div>

                  {profile.bio && (
                    <Text
                      size="sm"
                      className="text-text text-center max-w-xs px-2 mt-1 break-words"
                    >
                      {profile.bio}
                    </Text>
                  )}

                  <div className="flex items-center gap-2 text-text-muted text-sm bg-surface-elevated/40 border border-border/60 px-4 py-2 rounded-xl mt-4 w-full justify-center max-w-xs shrink-0">
                    <svg
                      className="w-4 h-4 text-primary"
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

                  {showSendButton && (
                    <div className="w-full max-w-xs mt-auto pt-6 shrink-0">
                      <button
                        onClick={handleSendMessage}
                        disabled={creatingChat}
                        className="w-full bg-primary disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition"
                      >
                        {creatingChat ? 'Creating...' : 'Send message'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Вкладка Медиа файлов */}
              {activeTab === 'media' && chatId && (
                <div className="flex-1 w-full p-4 overflow-y-auto min-h-0 animate-fade-in custom-scrollbar">
                  <ProfileMediaPanel chatId={chatId} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Фиксированное меню переключения табов внизу */}
        {chatId && !isLoading && profile && (
          <div className="border-t border-border bg-surface-elevated/40 backdrop-blur shrink-0 p-1.5">
            <div className="flex bg-surface/50 p-1 rounded-xl border border-border/40">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                  activeTab === 'profile'
                    ? 'text-text bg-primary/10 shadow-sm font-semibold border border-primary/20'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('media')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                  activeTab === 'media'
                    ? 'text-text bg-primary/10 shadow-sm font-semibold border border-primary/20'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Media
              </button>
            </div>
          </div>
        )}
      </div>
      {avatarHistoryOpen && (
        <AvatarCarousel
          isOpen={avatarHistoryOpen}
          onClose={() => setAvatarHistoryOpen(false)}
          userId={userId}
          readOnly
        />
      )}
    </div>,
    document.body,
  );
}
