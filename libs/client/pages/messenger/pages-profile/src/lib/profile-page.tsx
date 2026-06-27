import { useState } from 'react';

import { useMeQuery } from '@org/entities-user';
import { AvatarCarousel } from '@org/features-upload-avatar';
import { Avatar, Badge, Button, Heading, Text } from '@org/shared';
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
          <div className="flex flex-col items-center justify-center min-h-full gap-6 py-8 px-4">
            <button
              type="button"
              onClick={() => setIsCarouselOpen(true)}
              className="group relative cursor-pointer"
            >
              <Avatar
                src={me.avatarUrl ?? undefined}
                name={displayName}
                size="xl"
              />
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center border-2 border-surface shadow-md">
                <svg
                  className="w-3.5 h-3.5 text-white"
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
              </div>
            </button>

            <div className="text-center">
              <Heading
                level={4}
                as="h2"
                className="flex items-center justify-center gap-2"
              >
                {displayName}
                {me.role === 'CREATOR' && (
                  <Badge variant="primary" size="md" className="bg-gradient-to-r from-yellow-500 to-orange-500 border-0">
                    Creator
                  </Badge>
                )}
              </Heading>
              <Text
                color="muted"
                size="sm"
              >
                {me.email}
              </Text>
            </div>

            {me.bio && (
              <div className="w-full max-w-sm p-4 bg-surface-elevated rounded-xl text-center">
                <Text size="sm">{me.bio}</Text>
              </div>
            )}

            <div className="w-full max-w-sm flex items-center gap-4 p-4 bg-surface-elevated rounded-xl">
              <svg
                className="w-5 h-5 shrink-0 text-text-muted"
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
              <span className="text-sm text-text-muted truncate">{me.email}</span>
            </div>

            <Button
              className="max-w-sm w-full"
              onClick={() => navigate('/chats/profile/edit')}
            >
              Edit Profile
            </Button>
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
