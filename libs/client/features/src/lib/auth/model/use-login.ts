import { useNavigate } from 'react-router';
import { CLIENT_ROUTES } from '@org/common';
import { toast } from '@org/shared';
import { useLoginMutation, useSessionStore } from '@org/entities';
import type { z } from 'zod';
import type { loginSchema } from '@org/common';

type LoginValues = z.infer<typeof loginSchema>;

export function useLogin() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useLoginMutation();
  const setCredentials = useSessionStore((s) => s.setCredentials);

  const login = async (values: LoginValues) => {
    try {
      const { accessToken } = await mutateAsync(values);
      setCredentials(accessToken);
      navigate(CLIENT_ROUTES.chats.root);
    } catch {
      toast.error('Invalid email or password');
    }
  };

  return { login, isPending };
}
