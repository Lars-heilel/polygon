const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}/${path}`;
  console.log(`[apiFetch] → ${url}`, { method: init?.method ?? 'GET', credentials: 'include' });

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  console.log(`[apiFetch] ← ${url} → ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
