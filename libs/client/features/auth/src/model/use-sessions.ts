import { CLIENT_ROUTES } from '@org/common';
import { authApi, useSessionStore } from '@org/entities-user';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

export function useSessions() {
  const queryClient = useQueryClient();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);
  const navigate = useNavigate();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: authApi.getSessions,
  });

  const currentSessionId = sessions.find((s) => s.isCurrent)?.id;

  const revokeMutation = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (sessionId === currentSessionId) {
        setAuthenticated(false);
        navigate(CLIENT_ROUTES.auth.login);
      }
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: authApi.revokeAllSessions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  return {
    sessions,
    isLoading,
    revokeSession: (sessionId: string) => revokeMutation.mutateAsync(sessionId),
    revokeAllSessions: () => revokeAllMutation.mutateAsync(),
    isRevoking: revokeMutation.isPending,
    isRevokingAll: revokeAllMutation.isPending,
  };
}
