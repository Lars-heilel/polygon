interface ApiEnv {
  DEV?: boolean;
  VITE_API_URL?: string;
}

interface ApiLocation {
  hostname: string;
  port: string;
  protocol: string;
}

const LOCAL_DEV_FRONTEND_PORTS = new Set(['4200', '4300']);

export function resolveApiBaseUrl(
  env: ApiEnv = import.meta.env,
  location: ApiLocation = window.location,
): string {
  const configuredUrl = env.VITE_API_URL;

  if (env.DEV && configuredUrl && shouldUseDevProxy(configuredUrl, location)) {
    return '/api';
  }

  return configuredUrl ?? '/api';
}

function shouldUseDevProxy(configuredUrl: string, location: ApiLocation): boolean {
  if (!LOCAL_DEV_FRONTEND_PORTS.has(location.port)) {
    return false;
  }

  try {
    const url = new URL(configuredUrl);
    return (
      location.protocol === 'http:' &&
      url.protocol === 'http:' &&
      url.hostname === 'localhost' &&
      url.port === '3000' &&
      url.pathname.replace(/\/+$/, '') === '/api'
    );
  } catch {
    return false;
  }
}

function joinApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinApiUrl(resolveApiBaseUrl(), path);

  const res = await fetch(url, {
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
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
