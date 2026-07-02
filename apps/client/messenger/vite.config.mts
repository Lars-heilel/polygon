/// <reference types='vitest' />
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    process.env['NODE_ENV'] = 'production';
  }

  // Nx автоматически грузит .env в process.env до Vite.
  // Vite отдаёт приоритет process.env, из-за чего .env.production не перебивает .env.
  // Удаляем, чтобы Vite сам прочитал правильный файл по mode.
  delete process.env['VITE_API_URL'];
  delete process.env['VITE_SOCKET_URL'];

  const repoRoot = resolve(import.meta.dirname, '../../..');

  return {
    root: import.meta.dirname,
    envDir: repoRoot,
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    cacheDir: '../../../node_modules/.vite/apps/client/messenger',
    server: {
      port: 4200,
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
      port: 4200,
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
    plugins: [tailwindcss(), react(), visualizer({ open: true, gzipSize: true, brotliSize: true })],
    resolve: {
      conditions: ['@org/source'],
    },
    optimizeDeps: {
      include: ['@emoji-mart/react', '@emoji-mart/data'],
    },
    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [],
    // },
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
          sw: resolve(import.meta.dirname, 'sw.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            return chunkInfo.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js';
          },
          manualChunks(id) {
            if (id.includes('react-virtuoso')) return 'chunk-virtuoso';
            if (id.includes('react-hook-form') || id.includes('@hookform/resolvers'))
              return 'chunk-auth-vendor';
            if (id.includes('socket.io-client') || id.includes('engine.io-client'))
              return 'chunk-socket';
          },
        },
      },
    },
  };
});
