import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUserProfile, type UserProfile } from './profile.api.js';

export function useUserProfileQuery(userId: string) {
  return useQuery<UserProfile>({
    queryKey: ['user-profile', userId],
    queryFn: () => fetchUserProfile(userId),
    enabled: !!userId,
  });
}

export function invalidateUserProfile(userId: string) {
  const queryClient = useQueryClient();
  queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
}
