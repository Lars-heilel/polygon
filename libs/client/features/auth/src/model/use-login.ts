import { CLIENT_ROUTES } from '@org/common';
import type { loginSchema } from '@org/common';
import { useLoginMutation, useSessionStore } from '@org/entities-user';
import { ApiError, toast } from '@org/shared';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

type LoginValues = z.infer<typeof loginSchema>;

const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const VERIFY_EMAIL_MESSAGE = 'Please verify your email before signing in';

export function useLogin() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useLoginMutation();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);

  const login = async (values: LoginValues) => {
    try {
      await mutateAsync(values);
      setAuthenticated(true);
      navigate(CLIENT_ROUTES.chats.root);
    } catch (err) {
      toast.error(getLoginErrorMessage(err));
    }
  };

  return { login, isPending };
}

function getLoginErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return GENERIC_LOGIN_ERROR;
  }

  const message = getApiMessage(err.data);

  if (err.status === 429) {
    return message ?? 'Too many login attempts. Please try again later.';
  }

  if (err.status === 401 && message === VERIFY_EMAIL_MESSAGE) {
    return VERIFY_EMAIL_MESSAGE;
  }

  return GENERIC_LOGIN_ERROR;
}

function getApiMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return null;
  }

  const { message } = data;
  return typeof message === 'string' ? message : null;
}
