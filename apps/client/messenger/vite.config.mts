/// <reference types='vitest' />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  // Загружаем .env из корня репозитория с префиксом VITE_
  loadEnv(mode, '../../..', 'VITE_');

  return {
    root: import.meta.dirname,
    envDir: '../../..',
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    cacheDir: '../../../node_modules/.vite/apps/client/messenger',
    server: {
      port: 4200,
      host: true,
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
    },
    plugins: [tailwindcss(), react(), visualizer({ open: true, gzipSize: true, brotliSize: true })],
    resolve: {
      conditions: ['@org/source'],
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
    },
  };
});
