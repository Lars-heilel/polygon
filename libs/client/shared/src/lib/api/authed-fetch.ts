import { Mutex } from 'async-mutex';

import { API_ROUTES } from '@org/common';

import { ApiError, apiFetch } from './client';

const refreshMutex = new Mutex();
let onUnauthenticated: (() => void) | null = null;

export function configureAuthedFetch(cb: () => void): void {
  onUnauthenticated = cb;
}

export async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    return refreshMutex.runExclusive(async () => {
      try {
        await apiFetch<void>(API_ROUTES.auth.refresh, { method: 'POST' });
        return apiFetch<T>(path, init);
      } catch {
        onUnauthenticated?.();
        throw err;
      }
    });
  }
}
