import { useState } from 'react';

import { useMeQuery } from '@org/entities-user';
import { AvatarCarousel } from '@org/features-upload-avatar';
import { ProfileHeader } from '@org/features-user-profile';
import { Button, Heading } from '@org/shared';
import { useNavigate } from 'react-router';

export function ProfilePage() {
  const { data: me } = useMeQuery();
  const navigate = useNavigate();
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);

  if (!me) return null;

  const displayName = me.displayName ?? me.name ?? me.email.slice(0, 8);

  return (
    <>
      <div className="flex flex-col h-full bg-surface">
        <header className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/chats')}
            aria-label="Back"
            className="p-2 hover:bg-surface-elevated rounded-lg transition-colors"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <Heading
            level={5}
            as="h2"
          >
            Profile
          </Heading>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
            <ProfileHeader
              avatarUrl={me.avatarUrl}
              displayName={displayName}
              handleName={me.name}
              role={me.role}
              bio={me.bio}
              email={me.email}
              onAvatarClick={() => setIsCarouselOpen(true)}
              avatarBadge={
                <span
                  aria-hidden="true"
                  className="absolute right-1 bottom-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-primary text-white shadow-md"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </span>
              }
              actions={
                <Button
                  className="mt-3 w-full max-w-xs"
                  onClick={() => navigate('/chats/profile/edit')}
                >
                  Edit Profile
                </Button>
              }
            />

          </div>
        </div>
      </div>

      <AvatarCarousel
        isOpen={isCarouselOpen}
        onClose={() => setIsCarouselOpen(false)}
      />
    </>
  );
}
