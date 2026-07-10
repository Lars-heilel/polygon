import { useMutation, useQueryClient } from '@tanstack/react-query';

import { API_ROUTES, type AdminBanRequest } from '@org/common';
import { adminKeys } from '@org/entities-admin';
import { authedFetch, toast } from '@org/shared';

interface UseAdminBanOptions {
  onSuccess?: () => void;
}

export function useAdminBan(userId: string, options: UseAdminBanOptions = {}) {
  const queryClient = useQueryClient();

  const handleSuccess = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.all });
    toast.success(message);
    options.onSuccess?.();
  };

  const banMutation = useMutation({
    mutationFn: (request: AdminBanRequest) =>
      authedFetch<void>(API_ROUTES.admin.ban(userId), {
        body: JSON.stringify(request),
        method: 'POST',
      }),
    onSuccess: () => handleSuccess('User banned'),
    onError: () => {
      toast.error('Could not update ban');
    },
  });

  const unbanMutation = useMutation({
    mutationFn: () =>
      authedFetch<void>(API_ROUTES.admin.ban(userId), {
        method: 'DELETE',
      }),
    onSuccess: () => handleSuccess('User unbanned'),
    onError: () => {
      toast.error('Could not update ban');
    },
  });

  return {
    ban: banMutation,
    isPending: banMutation.isPending || unbanMutation.isPending,
    unban: unbanMutation,
  };
}
