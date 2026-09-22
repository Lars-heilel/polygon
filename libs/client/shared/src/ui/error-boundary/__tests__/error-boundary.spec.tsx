import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadErrorBoundary(production: boolean) {
  vi.resetModules();
  vi.stubEnv('DEV', !production);
  vi.stubEnv('PROD', production);

  return import('../error-boundary');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('handles production errors without network reporting or console output', async () => {
    const { ErrorBoundary } = await loadErrorBoundary(true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }));
    const boundary = new ErrorBoundary({ children: null });

    boundary.componentDidCatch(new Error('Exploded'), { componentStack: 'at TestComponent' });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('derives error state for fallback rendering', async () => {
    const { ErrorBoundary } = await loadErrorBoundary(true);

    expect(ErrorBoundary.getDerivedStateFromError(new Error('Exploded'))).toEqual(
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});
