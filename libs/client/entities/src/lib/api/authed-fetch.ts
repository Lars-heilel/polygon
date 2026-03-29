import { Mutex } from 'async-mutex';
import { apiFetch, ApiError } from '@org/shared';
import { API_ROUTES } from '@org/common';
import type { TokenPair } from '../user/user.api';
import { useSessionStore } from '../session/session.store';

const refreshMutex = new Mutex();

async function refreshTokens(): Promise<string> {
  const pair = await apiFetch<TokenPair>(API_ROUTES.auth.refresh, {
    method: 'POST',
  });
  useSessionStore.getState().setCredentials(pair.accessToken);
  return pair.accessToken;
}

export async function authedFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = useSessionStore.getState().accessToken;

  try {
    return await apiFetch<T>(path, { ...init, token });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    return refreshMutex.runExclusive(async () => {
      const currentToken = useSessionStore.getState().accessToken;

      if (currentToken && currentToken !== token) {
        return apiFetch<T>(path, { ...init, token: currentToken });
      }

      try {
        const newToken = await refreshTokens();
        return apiFetch<T>(path, { ...init, token: newToken });
      } catch {
        useSessionStore.getState().clearCredentials();
        throw err;
      }
    });
  }
}
