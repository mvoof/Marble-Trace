import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { playwright } from '@vitest/browser-playwright';

import { createStorybookAliases, SCSS_ADDITIONAL_DATA } from './vite.aliases';

/**
 * Render budgets. A separate config, and a separate command, from `npm test`.
 *
 * Browser mode rather than jsdom on purpose: the sanctioned bypass for hot
 * fields writes CSS custom properties inside `requestAnimationFrame`, and in
 * jsdom both the frame and the style write are fake, so a test there would
 * prove nothing. See `docs/rendering.md`.
 *
 * `NODE_ENV` is deliberately left alone. MobX's `spy` — which is how wake-ups
 * are counted — is a no-op in a production MobX build, and a config that set
 * `NODE_ENV=production` would make every budget silently pass with zero.
 */
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
      },
    }),
  ],

  // The Storybook aliases, not the plain layer ones: a widget mounted outside
  // Tauri reaches a backend module the same way a story does, and these swap
  // each one for the mock the project already ships.
  resolve: {
    alias: createStorybookAliases(),
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: SCSS_ADDITIONAL_DATA,
      },
    },
  },

  test: {
    name: 'perf',
    include: ['src/**/*.perf.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
