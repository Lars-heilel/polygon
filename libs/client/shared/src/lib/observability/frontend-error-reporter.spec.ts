import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  configureFrontendErrorReporting,
  reportFrontendError,
} from './frontend-error-reporter';

describe('frontend error reporter', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
  });

  it('posts frontend errors to the gateway intake endpoint', () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal('fetch', fetchMock);
    configureFrontendErrorReporting('admin');

    reportFrontendError(new Error('Exploded'), 'at AdminShell');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/observability/frontend-errors',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(
      expect.objectContaining({
        app: 'admin',
        message: 'Exploded',
        componentStack: 'at AdminShell',
        route: '/',
        userAgent: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
  });

  it('does not include query params or hash fragments in logged routes', () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/reset-password?token=secret#confirm');
    configureFrontendErrorReporting('messenger');

    reportFrontendError(new Error('Exploded'));

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(
      expect.objectContaining({
        route: '/reset-password',
      }),
    );
  });
});
