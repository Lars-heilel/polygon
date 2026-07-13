import { CLIENT_ROUTES } from '@org/common';
import type { loginSchema } from '@org/common';
import { useLoginMutation, useSessionStore } from '@org/entities-user';
import { ApiError, toast } from '@org/shared';
import { useLocation, useNavigate } from 'react-router';
import type { z } from 'zod';

type LoginValues = z.infer<typeof loginSchema>;
type PostLoginRedirect = { type: 'internal'; to: string } | { type: 'external'; href: string };

const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const VERIFY_EMAIL_MESSAGE = 'Please verify your email before signing in';

export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutateAsync, isPending } = useLoginMutation();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);

  const login = async (values: LoginValues) => {
    try {
      await mutateAsync(values);
      setAuthenticated(true);

      const redirect = getPostLoginRedirect(location.search);
      if (redirect.type === 'external') {
        window.location.assign(redirect.href);
        return;
      }

      navigate(redirect.to);
    } catch (err) {
      toast.error(getLoginErrorMessage(err));
    }
  };

  return { login, isPending };
}

export function getPostLoginRedirect(
  search: string,
  origin = window.location.origin,
): PostLoginRedirect {
  const from = new URLSearchParams(search).get('from');

  if (from === `${CLIENT_ROUTES.admin.root}/`) {
    const url = new URL(from, origin);

    if (url.port === '4200') {
      url.port = '4300';
      return { type: 'external', href: url.toString() };
    }

    return { type: 'external', href: from };
  }

  return { type: 'internal', to: CLIENT_ROUTES.chats.root };
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
