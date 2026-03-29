import { useNavigate } from 'react-router';
import { CLIENT_ROUTES } from '@org/common';
import { toast } from '@org/shared';
import { useRegisterMutation, useSessionStore } from '@org/entities';
import type { z } from 'zod';
import type { registerSchema } from '@org/common';

type RegisterValues = z.infer<typeof registerSchema>;

export function useRegister() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useRegisterMutation();
  const setCredentials = useSessionStore((s) => s.setCredentials);

  const register = async (values: RegisterValues) => {
    try {
      const { accessToken } = await mutateAsync(values);
      setCredentials(accessToken);
      navigate(CLIENT_ROUTES.chats.root);
    } catch {
      toast.error('Registration failed. Please try again.');
    }
  };

  return { register, isPending };
}
