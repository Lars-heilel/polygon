import { Avatar, Badge, Heading, Skeleton, Text } from '@org/shared';

import { useUserProfileQuery } from '../api/use-user-profile.js';

interface UserProfileInfoProps {
  userId: string;
}

export function UserProfileInfo({ userId }: UserProfileInfoProps) {
  const { data: profile, isLoading, isError } = useUserProfileQuery(userId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <Text size="sm" color="muted" className="py-6 text-center">
        Failed to load profile
      </Text>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6 px-4">
      <Avatar src={profile.avatarUrl ?? undefined} name={profile.displayName ?? profile.name} size="xl" />
      <div className="text-center">
        <Heading level={5} as="h3" className="flex items-center justify-center gap-2">
          {profile.displayName ?? profile.name}
          {profile.role === 'CREATOR' && <Badge variant="warning">Creator</Badge>}
        </Heading>
        <Text size="xs" color="muted">
          @{profile.name}
        </Text>
      </div>
      {profile.bio && (
        <Text size="sm" className="max-w-xs text-center">
          {profile.bio}
        </Text>
      )}
      <div className="flex max-w-xs items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="min-w-0 truncate">{profile.email}</span>
      </div>
    </div>
  );
}
