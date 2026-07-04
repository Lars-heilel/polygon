import { authedFetch } from '@org/shared';

export interface UserProfile {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  email: string;
}

export function fetchUserProfile(userId: string): Promise<UserProfile> {
  return authedFetch<UserProfile>(`users/${userId}/profile`);
}
