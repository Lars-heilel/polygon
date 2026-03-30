import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { CLIENT_ROUTES } from '@org/common';
import { useLogoutMutation, useSessionStore } from '@org/entities';

export function useLogout() {
  const navigate = useNavigate();
  const { mutate } = useLogoutMutation();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);

  const logout = useCallback(() => {
    mutate(undefined, {
      onSuccess: () => {
        setAuthenticated(false);
        navigate(CLIENT_ROUTES.auth.login);
      },
      onError: () => {
        setAuthenticated(false);
        navigate(CLIENT_ROUTES.auth.login);
      },
    });
  }, [mutate, navigate, setAuthenticated]);

  return { logout };
}
