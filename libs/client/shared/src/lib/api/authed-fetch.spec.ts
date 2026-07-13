import { API_ROUTES } from '@org/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authedFetch, configureAuthedFetch } from './authed-fetch';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), init);
}

function emptyResponse(init?: ResponseInit): Response {
  return new Response(null, init);
}

describe('authedFetch', () => {
  afterEach(() => {
    configureAuthedFetch(() => undefined);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('refreshes cookies and retries the original request once after a 401', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = String(input);

      if (url.endsWith(`/api/${API_ROUTES.auth.refresh}`)) {
        return Promise.resolve(emptyResponse({ status: 204 }));
      }

      if (url.endsWith('/api/users/me') && fetchMock.mock.calls.length === 1) {
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, { status: 401 }));
      }

      return Promise.resolve(jsonResponse({ id: 'user-1', email: 'user@example.com' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(authedFetch('users/me')).resolves.toEqual({
      id: 'user-1',
      email: 'user@example.com',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      expect.stringMatching(/\/api\/users\/me$/),
      expect.stringMatching(/\/api\/auth\/refresh$/),
      expect.stringMatching(/\/api\/users\/me$/),
    ]);
  });

  it('shares one refresh request across parallel 401 responses', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = String(input);

      if (url.endsWith(`/api/${API_ROUTES.auth.refresh}`)) {
        return Promise.resolve(emptyResponse({ status: 204 }));
      }

      if (url.endsWith('/api/users/me') && fetchMock.mock.calls.length <= 2) {
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, { status: 401 }));
      }

      return Promise.resolve(jsonResponse({ id: 'user-1' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(Promise.all([authedFetch('users/me'), authedFetch('users/me')])).resolves.toEqual([
      { id: 'user-1' },
      { id: 'user-1' },
    ]);

    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.filter((url) => url.endsWith('/api/auth/refresh'))).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith('/api/users/me'))).toHaveLength(4);
  });

  it('marks the session unauthenticated when refresh fails', async () => {
    const onUnauthenticated = vi.fn();
    configureAuthedFetch(onUnauthenticated);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = String(input);

        if (url.endsWith(`/api/${API_ROUTES.auth.refresh}`)) {
          return Promise.resolve(jsonResponse({ message: 'Refresh expired' }, { status: 401 }));
        }

        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, { status: 401 }));
      }),
    );

    await expect(authedFetch('users/me')).rejects.toMatchObject({
      status: 401,
      data: { message: 'Unauthorized' },
    });

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });
});
