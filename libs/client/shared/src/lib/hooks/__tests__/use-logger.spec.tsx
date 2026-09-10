import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadUseLogger(production: boolean) {
  vi.resetModules();
  vi.stubEnv('PROD', production);

  const mod = await import('../use-logger');
  return mod;
}

describe('useLogger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not write browser console output in production builds', async () => {
    const { useLogger } = await loadUseLogger(true);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    const { result } = renderHook(() => useLogger('Auth'));

    result.current.log('registered', { email: 'user@example.com' });
    result.current.warn('warning', { token: 'secret' });
    result.current.error('failed', { password: 'secret' });
    result.current.debug('debug', { refreshToken: 'secret' });
    result.current.verbose('verbose', { accessToken: 'secret' });

    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleDebug).not.toHaveBeenCalled();
  });

  it('writes formatted diagnostics in development builds', async () => {
    const { useLogger } = await loadUseLogger(false);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { result } = renderHook(() => useLogger('Auth'));

    result.current.log('bootstrapped');

    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('[Auth]'),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('provides a non-hook logger for development-only diagnostics', async () => {
    const { frontendLog } = await loadUseLogger(false);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    frontendLog('warn', 'Env', 'invalid_env', { issueCount: 1 });

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[Env]'),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      { issueCount: 1 },
    );
  });
});
