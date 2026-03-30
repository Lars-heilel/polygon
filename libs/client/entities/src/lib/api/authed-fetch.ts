import { Mutex } from 'async-mutex';
import { apiFetch, ApiError } from '@org/shared';
import { API_ROUTES } from '@org/common';
import { useSessionStore } from '../session/session.store';

const refreshMutex = new Mutex();

export async function authedFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    return refreshMutex.runExclusive(async () => {
      try {
        await apiFetch<void>(API_ROUTES.auth.refresh, { method: 'POST' });
        return apiFetch<T>(path, init);
      } catch {
        useSessionStore.getState().setAuthenticated(false);
        throw err;
      }
    });
  }
}
