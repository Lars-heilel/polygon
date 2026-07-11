import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from './client';

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
});
