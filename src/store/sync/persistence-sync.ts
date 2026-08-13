import { load } from '@tauri-apps/plugin-store';

import {
  backupSettingsFile,
  settingsFileExists,
  hydrateStores,
  saveSettings,
  SETTINGS_FILE,
  type Settings,
} from './persistence';
import { runMigrations } from '@platform/settings-schema/index';
import type { MigrationResult } from '@platform/settings-schema/types';
import type { RootStore } from '../root-store';

/**
 * Settings-file bootstrap shared by both windows.
 *
 * Ordering contract: everything here runs *before* any reaction is registered.
 * `readSettingsFile` → `hydrateFromDisk` → (caller checks `settingsLocked`) →
 * `createSaveHandle`. Registering a save reaction before hydration would write
 * defaults over the user's file within a second of start.
 */

export interface SettingsFileHandle {
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

export const readSettingsFile = async (): Promise<{
  store: SettingsFileHandle;
  loaded: Settings | null | undefined;
}> => {
  const store = await load(SETTINGS_FILE);
  const loaded = await store.get<Settings>('settings');

  return { store, loaded };
};

/**
 * Brings the settings file to the current schema and fills the stores from it.
 *
 * When it cannot — the file was written by a newer build, predates the chain,
 * or is not a settings object — the settings are locked rather than repaired.
 * A file we do not understand is worth more to the user intact than replaced
 * with defaults, and it can be sent to us as-is.
 *
 * `backup` belongs to the main window only: both windows run the chain, but
 * only one of them may touch the file.
 */
export const hydrateFromDisk = async (
  root: RootStore,
  loaded: Settings | null | undefined,
  { backup }: { backup: boolean }
) => {
  // The plugin hands back nothing both for a fresh install and for a file it
  // could not parse — a stray BOM, a half-written save. Only the filesystem
  // separates them, and seeding defaults over the second overwrites exactly the
  // file this whole path exists to protect.
  if (!loaded) {
    if (await settingsFileExists()) {
      console.error('Settings locked: present on disk but could not be read');
      root.appSettings.lockSettings('corrupt');
    }

    return;
  }

  // A migration step reads shapes that no current type describes, straight out
  // of a file the user may have hand-edited. A step that throws on one would
  // otherwise take the whole window down with it — no hydration, but no lock
  // and no banner either, which is the one outcome this path exists to avoid.
  let result: MigrationResult;

  try {
    result = runMigrations(loaded);
  } catch (error) {
    console.error('Settings locked: the migration chain threw:', error);
    root.appSettings.lockSettings('corrupt');

    return;
  }

  if (
    result.status === 'from-the-future' ||
    result.status === 'too-old' ||
    result.status === 'corrupt'
  ) {
    console.error(`Settings locked: ${result.status}`);
    root.appSettings.lockSettings(result.status);

    return;
  }

  if (result.status === 'migrated' && backup) {
    await backupSettingsFile(result.from);
  }

  try {
    hydrateStores(root, result.blob as Partial<Settings>);
  } catch (error) {
    console.error('Failed to hydrate settings:', error);
    root.appSettings.lockSettings('corrupt');
  }
};

/**
 * The one way settings reach disk. Locked settings never write — a file this
 * build could not migrate must survive the session untouched.
 */
export const createSaveHandle =
  (root: RootStore, store: SettingsFileHandle) => (): Promise<void> =>
    root.appSettings.settingsLocked
      ? Promise.resolve()
      : saveSettings(store, root);
