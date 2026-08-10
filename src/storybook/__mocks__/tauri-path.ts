export const appDataDir = async (): Promise<string> => '/mock/app-data';

export const join = async (...parts: string[]): Promise<string> =>
  parts.join('/');

/**
 * `@tauri-apps/plugin-fs` re-exports this from `@tauri-apps/api/path`, which is
 * aliased to this mock — without it Vite's dependency optimizer fails to
 * resolve the re-export and no story loads at all. Only the members
 * `layout-background.ts` actually passes are listed; the numbers are the real
 * plugin's, so a story that logs one shows the same value the app would.
 */
export const BaseDirectory = {
  AppData: 15,
  AppLocalData: 16,
  AppConfig: 13,
  AppCache: 12,
} as const;
