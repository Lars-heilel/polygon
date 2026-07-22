import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('frontend console policy', () => {
  it('keeps direct browser console calls centralized in the shared logger', () => {
    const workspaceRoot = resolve(__dirname, '../../../../../');

    expect(() =>
      execFileSync(
        'rg',
        [
          '-n',
          'console\\.',
          'apps/client/messenger',
          'libs/client',
          '-g',
          '!**/use-logger.ts',
          '-g',
          '!**/*.spec.*',
        ],
        { cwd: workspaceRoot, encoding: 'utf8' },
      ),
    ).toThrow();
  });

  it('does not register a service worker in development builds', () => {
    const workspaceRoot = resolve(__dirname, '../../../../../');
    const mainSource = readFileSync(
      resolve(workspaceRoot, 'apps/client/messenger/src/app/main.tsx'),
      'utf8',
    );

    expect(mainSource).toContain('import.meta.env.PROD');
    expect(mainSource).toContain('navigator.serviceWorker.register');
  });
});
