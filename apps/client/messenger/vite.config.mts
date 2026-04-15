/// <reference types='vitest' />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Nx не выставляет NODE_ENV при запуске vite build, из-за чего @nx/react/babel
  // выбирает dev-трансформ (jsxDEV) вместо production (jsx/jsxs).
  if (mode === 'production') {
    process.env['NODE_ENV'] = 'production';
  }

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
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('/react-router/')) {
              return 'vendor-router';
            }

            if (id.includes('/@tanstack/')) {
              return 'vendor-query';
            }

            if (id.includes('/socket.io') || id.includes('/engine.io')) {
              return 'vendor-socket';
            }

            return 'vendor';
          },
        },
      },
    },
  };
});
