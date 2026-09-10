import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadErrorBoundary(production: boolean) {
  vi.resetModules();
  vi.stubEnv('DEV', !production);
  vi.stubEnv('PROD', production);

  const errorReporter = await import('../../../lib/observability/frontend-error-reporter');
  errorReporter.configureFrontendErrorReporting('messenger');
  return import('../error-boundary');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports production errors without direct browser console output', async () => {
    const { ErrorBoundary } = await loadErrorBoundary(true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    const boundary = new ErrorBoundary({ children: null });

    boundary.componentDidCatch(new Error('Exploded'), { componentStack: 'at TestComponent' });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/observability/frontend-errors',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(consoleError).not.toHaveBeenCalled();
  });
});
