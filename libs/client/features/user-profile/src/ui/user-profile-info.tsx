import { useUserProfileQuery } from '../api/use-user-profile.js';
import { Avatar, Heading, Text } from '@org/shared';

interface UserProfileInfoProps {
  userId: string;
}

export function UserProfileInfo({ userId }: UserProfileInfoProps) {
  const { data: profile, isLoading, isError } = useUserProfileQuery(userId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-24 h-24 rounded-full bg-surface-elevated animate-pulse" />
        <div className="h-5 w-32 bg-surface-elevated animate-pulse rounded" />
        <div className="h-4 w-24 bg-surface-elevated animate-pulse rounded" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="py-6 text-center text-text-muted text-sm">
        Failed to load profile
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6 px-4">
      <Avatar src={profile.avatarUrl ?? undefined} name={profile.displayName ?? profile.name} size="xl" />
      <div className="text-center">
        <Heading level={5} as="h3">
          {profile.displayName ?? profile.name}
        </Heading>
        <Text size="xs" className="text-text-muted">
          @{profile.name}
        </Text>
      </div>
      {profile.bio && (
        <Text size="sm" className="text-text text-center max-w-xs">
          {profile.bio}
        </Text>
      )}
      <div className="flex items-center gap-1.5 text-text-muted text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span>{profile.email}</span>
      </div>
    </div>
  );
}
