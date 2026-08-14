import path from 'path';
import { fileURLToPath } from 'url';

const currentFilename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(currentFilename);

interface AliasEntry {
  find: string;
  replacement: string;
}

const fromRoot = (relativePath: string) => path.resolve(rootDir, relativePath);

/**
 * Ordered longest-prefix-first: Vite matches string aliases by prefix, so the
 * layer aliases must come before the catch-all '@'. Shared by vite.config.ts and
 * .storybook/main.ts so the two can never drift apart.
 */
export const createLayerAliases = (): AliasEntry[] => [
  {
    find: '@platform/services',
    replacement: fromRoot('./src/platform/services'),
  },
  { find: '@platform/sync', replacement: fromRoot('./src/platform/sync') },
  {
    find: '@platform/settings-schema',
    replacement: fromRoot('./src/platform/settings-schema'),
  },
  { find: '@ui/app', replacement: fromRoot('./src/ui/app') },
  { find: '@ui/widgets', replacement: fromRoot('./src/ui/widgets') },
  { find: '@ui/shared', replacement: fromRoot('./src/ui/shared') },
  { find: '@ui/hooks', replacement: fromRoot('./src/ui/hooks') },
  { find: '@store', replacement: fromRoot('./src/store') },
  { find: '@utils', replacement: fromRoot('./src/utils') },
  { find: '@assets', replacement: fromRoot('./src/assets') },
  { find: '@', replacement: fromRoot('./src') },
];

const MOCKED_TAURI_MODULES: Record<string, string> = {
  '@tauri-apps/api/core': 'tauri-core',
  '@tauri-apps/api/event': 'tauri-event',
  '@tauri-apps/api/webviewWindow': 'tauri-webview',
  '@tauri-apps/api/window': 'tauri-window',
  '@tauri-apps/api/path': 'tauri-path',
  '@tauri-apps/api/app': 'tauri-app',
  '@tauri-apps/plugin-process': 'tauri-process',
  '@tauri-apps/plugin-store': 'tauri-store',
  '@tauri-apps/plugin-global-shortcut': 'tauri-shortcut',
  '@tauri-apps/plugin-updater': 'tauri-updater',
};

/**
 * Storybook runs in a plain browser with no Tauri runtime, so every backend
 * module is swapped for a mock. These come first: they are more specific than
 * the layer aliases and must win the prefix match.
 */
export const createStorybookAliases = (): AliasEntry[] => [
  ...Object.entries(MOCKED_TAURI_MODULES).map(([moduleId, mockName]) => ({
    find: moduleId,
    replacement: fromRoot(`./src/storybook/__mocks__/${mockName}.ts`),
  })),
  ...createLayerAliases(),
];
