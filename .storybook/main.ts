import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  viteFinal: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(__dirname, '../src'),
      '@tauri-apps/api/core': path.resolve(
        __dirname,
        '../src/storybook/__mocks__/tauri-core.ts'
      ),
      '@tauri-apps/api/event': path.resolve(
        __dirname,
        '../src/storybook/__mocks__/tauri-event.ts'
      ),
      '@tauri-apps/api/webviewWindow': path.resolve(
        __dirname,
        '../src/storybook/__mocks__/tauri-webview.ts'
      ),
      '@tauri-apps/plugin-store': path.resolve(
        __dirname,
        '../src/storybook/__mocks__/tauri-store.ts'
      ),
      '@tauri-apps/plugin-global-shortcut': path.resolve(
        __dirname,
        '../src/storybook/__mocks__/tauri-shortcut.ts'
      ),
    };

    config.css = config.css ?? {};
    config.css.preprocessorOptions = {
      scss: {
        additionalData: `
          @use "@/styles/variables" as *;
          @use "@/styles/mixins" as *;
        `,
      },
    };

    return config;
  },
};

export default config;
