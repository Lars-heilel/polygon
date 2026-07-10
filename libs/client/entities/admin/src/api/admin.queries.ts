import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from './admin.api';

export const adminKeys = {
  all: ['admin'] as const,
  users: (query: string) => [...adminKeys.all, 'users', query] as const,
  user: (id: string) => [...adminKeys.all, 'user', id] as const,
  sessions: (id: string) => [...adminKeys.user(id), 'sessions'] as const,
};

export function useAdminUsersQuery(query: string) {
  return useQuery({
    queryKey: adminKeys.users(query),
    queryFn: () => adminApi.users(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}

export function useAdminUserQuery(id: string) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => adminApi.user(id),
  });
}

export function useAdminSessionsQuery(id: string) {
  return useQuery({
    queryKey: adminKeys.sessions(id),
    queryFn: () => adminApi.sessions(id),
  });
}

export function useAdminRevokeSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, sessionId }: { userId: string; sessionId: string }) =>
      adminApi.revokeSession(userId, sessionId),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.sessions(variables.userId) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.user(variables.userId) }),
      ]);
    },
  });
}

export function useAdminRevokeAllSessionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => adminApi.revokeAllSessions(userId),
    onSuccess: async (_data, userId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.sessions(userId) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.user(userId) }),
      ]);
    },
  });
}
