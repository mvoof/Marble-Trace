import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { createLayerAliases, SCSS_ADDITIONAL_DATA } from './vite.aliases';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
      },
    }),
  ],
  // Relative, so `remote.html` served from `/r/<slug>` still resolves its
  // assets — the remote server strips that prefix back off.
  base: './',

  build: {
    rollupOptions: {
      input: {
        // The windows Tauri opens.
        main: resolve(__dirname, 'index.html'),
        // A layout rendered in a browser on another device. A separate entry
        // because it must not pull in the Tauri API.
        remote: resolve(__dirname, 'remote.html'),
      },
    },
  },

  resolve: {
    alias: createLayerAliases(),
  },

  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: SCSS_ADDITIONAL_DATA,
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: {
      protocol: 'ws',
      host,
      port: 1421,
      overlay: false,
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}));
