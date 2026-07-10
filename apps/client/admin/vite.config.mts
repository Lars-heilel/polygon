/// <reference types='vitest' />
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    process.env['NODE_ENV'] = 'production';
  }

  delete process.env['VITE_API_URL'];
  delete process.env['VITE_SOCKET_URL'];

  const repoRoot = resolve(import.meta.dirname, '../../..');

  return {
    root: import.meta.dirname,
    base: '/admin/',
    envDir: repoRoot,
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    cacheDir: '../../../node_modules/.vite/apps/client/admin',
    server: {
      port: 4300,
      host: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      port: 4300,
      host: 'localhost',
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    plugins: [tailwindcss(), react()],
    resolve: {
      conditions: ['@org/source'],
    },
    build: {
      outDir: './dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
        },
      },
    },
  };
});
