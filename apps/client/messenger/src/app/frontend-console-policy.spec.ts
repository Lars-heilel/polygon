import { execFileSync } from 'node:child_process';
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
});
