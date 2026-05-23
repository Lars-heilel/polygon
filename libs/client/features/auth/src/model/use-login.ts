import { CLIENT_ROUTES } from '@org/common';
import type { loginSchema } from '@org/common';
import { useLoginMutation, useSessionStore } from '@org/entities-user';
import { toast } from '@org/shared';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

type LoginValues = z.infer<typeof loginSchema>;

export function useLogin() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useLoginMutation();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);

  const login = async (values: LoginValues) => {
    try {
      await mutateAsync(values);
      setAuthenticated(true);
      navigate(CLIENT_ROUTES.chats.root);
    } catch {
      toast.error('Invalid email or password');
    }
  };

  return { login, isPending };
}
