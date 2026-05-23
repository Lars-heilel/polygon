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
        output: {
          manualChunks(id) {
            if (id.includes('react-virtuoso')) return 'chunk-virtuoso'
            if (id.includes('react-markdown') || id.includes('react-syntax-highlighter') || id.includes('features-markdown')) return 'chunk-markdown'
            if (id.includes('react-hook-form') || id.includes('@hookform/resolvers')) return 'chunk-auth-vendor'
            if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'chunk-socket'
          },
        },
      },
    },
  };
});
