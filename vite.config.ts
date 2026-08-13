import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  base: './',

  resolve: {
    // Ordered longest-prefix-first: Vite matches string aliases by prefix, so the
    // layer aliases must come before the catch-all '@'.
    alias: [
      {
        find: '@platform/services',
        replacement: path.resolve(__dirname, './src/platform/services'),
      },
      {
        find: '@platform/sync',
        replacement: path.resolve(__dirname, './src/platform/sync'),
      },
      {
        find: '@platform/settings-schema',
        replacement: path.resolve(__dirname, './src/platform/settings-schema'),
      },
      { find: '@ui/app', replacement: path.resolve(__dirname, './src/app') },
      {
        find: '@ui/widgets',
        replacement: path.resolve(__dirname, './src/widgets'),
      },
      {
        find: '@ui/shared',
        replacement: path.resolve(__dirname, './src/components'),
      },
      {
        find: '@ui/hooks',
        replacement: path.resolve(__dirname, './src/hooks'),
      },
      { find: '@store', replacement: path.resolve(__dirname, './src/store') },
      { find: '@utils', replacement: path.resolve(__dirname, './src/utils') },
      { find: '@assets', replacement: path.resolve(__dirname, './src/assets') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @use "@/styles/functions" as *;
          @use "@/styles/variables" as *;
          @use "@/styles/widget-tokens" as *;
          @use "@/styles/sys-tokens" as *;
          @use "@/styles/opacity" as *;
        `,
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
