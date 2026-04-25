import { API_ROUTES } from '@org/common';

import { ApiError, apiFetch } from './client';

let inflightRefresh: Promise<void> | null = null;
let onUnauthenticated: (() => void) | null = null;

export function configureAuthedFetch(cb: () => void): void {
  onUnauthenticated = cb;
}

function refreshOnce(): Promise<void> {
  if (!inflightRefresh) {
    inflightRefresh = apiFetch<void>(API_ROUTES.auth.refresh, { method: 'POST' }).finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

export async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    try {
      await refreshOnce();
      return await apiFetch<T>(path, init);
    } catch {
      onUnauthenticated?.();
      throw err;
    }
  }
}
