import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const sourceAlias = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/client/entities/chat',
  plugins: [react()],
  resolve: {
    conditions: ['@org/source'],
    alias: {
      '@org/common': sourceAlias('../../../common/src/index.ts'),
      '@org/shared': sourceAlias('../../shared/src/index.ts'),
      '@org/crypto-e2ee': sourceAlias('../../crypto-e2ee/src/index.ts'),
      '@org/entities-message': sourceAlias('../../entities/message/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
