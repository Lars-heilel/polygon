const BASE_URL =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly data: unknown) {
    super(`HTTP ${status}`);
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data);
  }
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
