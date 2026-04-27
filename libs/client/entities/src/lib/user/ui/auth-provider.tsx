import { useEffect } from 'react';

import { authApi } from '../api/user.api';
import { useSessionStore } from '../model/session.store';

export function AuthBootstrap() {
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);

  useEffect(() => {
    authApi
      .me()
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, [setAuthenticated]);

  return null;
}
