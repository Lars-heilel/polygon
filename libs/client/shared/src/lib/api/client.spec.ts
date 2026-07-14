import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, resolveApiBaseUrl } from './client';

describe('apiFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not write request or response URLs to the browser console', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))),
    );

    await apiFetch('/auth/check-email?email=user@example.com');

    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('sends JSON requests with credentials included', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: 'password' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auth\/login$/),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('/api//auth/login');
  });

  it('uses the same-origin Vite proxy for split dev frontend apps', () => {
    expect(
      resolveApiBaseUrl(
        { DEV: true, VITE_API_URL: 'http://localhost:3000/api' },
        { hostname: 'localhost', port: '4300', protocol: 'http:' },
      ),
    ).toBe('/api');
    expect(
      resolveApiBaseUrl(
        { DEV: true, VITE_API_URL: 'http://localhost:3000/api' },
        { hostname: 'localhost', port: '4200', protocol: 'http:' },
      ),
    ).toBe('/api');
  });

  it('keeps the configured absolute API URL outside local split dev', () => {
    expect(
      resolveApiBaseUrl(
        { DEV: false, VITE_API_URL: 'https://www.polygon-by-lars-heilel.ru/api' },
        { hostname: 'www.polygon-by-lars-heilel.ru', port: '', protocol: 'https:' },
      ),
    ).toBe('https://www.polygon-by-lars-heilel.ru/api');
  });

  it('preserves sanitized error response data for auth error handling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Email already in use' }), { status: 409 }),
        ),
      ),
    );

    await expect(apiFetch('/auth/register')).rejects.toMatchObject({
      status: 409,
      data: { message: 'Email already in use' },
    });
  });

  it('handles empty successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));

    await expect(apiFetch('/auth/logout')).resolves.toBeUndefined();
  });
});
