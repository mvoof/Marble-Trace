import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { createLayerAliases, SCSS_ADDITIONAL_DATA } from './vite.aliases.ts';
import { devContentSecurityPolicy } from './vite.csp.ts';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    devContentSecurityPolicy(),
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
    // Hidden maps for `npm run perf -- --build`, which resolves a heap
    // profile's minified frames back to source files. Never in a release.
    sourcemap:
      process.env.MARBLE_TRACE_SOURCEMAPS === '1' ? ('hidden' as const) : false,
    rolldownOptions: {
      input: {
        // The windows Tauri opens, one page each, so a window bundles only
        // its own shell: the overlay never loads antd or the settings UI.
        main: resolve(import.meta.dirname, 'main.html'),
        overlay: resolve(import.meta.dirname, 'overlay.html'),
        hud: resolve(import.meta.dirname, 'hud.html'),
        // A layout rendered in a browser on another device. A separate entry
        // because it must not pull in the Tauri API.
        remote: resolve(import.meta.dirname, 'remote.html'),
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
