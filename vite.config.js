import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The React app is built into dist/ and served by the same zero-dependency Node server that
 * holds the incident state, so a demo is one process on one port with nothing to orchestrate.
 *
 * `npm run dev` runs Vite with HMR instead, proxying the API and the SSE stream through to the
 * incident server on 4173.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4173',
        changeOrigin: true,
        // Server-sent events die if the proxy buffers them.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache, no-transform';
            }
          });
        }
      }
    }
  }
});
