import { load } from '@tauri-apps/plugin-store';

import {
  backupSettingsFile,
  findLastGoodSettings,
  keepLastGoodSettings,
  settingsFileExists,
  hydrateStores,
  saveSettings,
  SETTINGS_FILE,
  type Settings,
} from './persistence';
import { runMigrations } from '@shared/settings-schema/migrate';
import type { MigrationResult } from '@shared/settings-schema/types';
import type { MainRoot } from '@app/roots/main-root';

/**
 * Settings-file bootstrap. Main's alone: it is the only window that reads the
 * file — every other one is sent a snapshot (ADR-0007).
 *
 * Ordering contract: everything here runs *before* any reaction is registered.
 * `readSettingsFile` → `hydrateFromDisk` → (caller checks `settingsLocked`) →
 * `createSaveHandle`. Registering a save reaction before hydration would write
 * defaults over the user's file within a second of start.
 */

export interface SettingsFileHandle {
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
  close(): Promise<void>;
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
 */
export const hydrateFromDisk = async (
  root: MainRoot,
  loaded: Settings | null | undefined
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

  if (result.status === 'migrated') {
    await backupSettingsFile(result.from);
  }

  try {
    hydrateStores(root, result.blob as Partial<Settings>);
  } catch (error) {
    console.error('Failed to hydrate settings:', error);
    root.appSettings.lockSettings('corrupt');

    return;
  }

  // Only a file read as it is: a migrated one is still the old format on disk
  // until the first save, and is `current` from the next start. Not awaited:
  // the copy is best effort and startup has no reason to wait on it.
  if (result.status === 'current') {
    void keepLastGoodSettings();
  }
};

/**
 * Holds a locked file still for the rest of the session, and offers the way
 * back when there is one.
 *
 * The store plugin saves every store it holds open when the app exits — a
 * relaunch included — so an open handle would write its cache over the file:
 * an empty `{}` over a corrupt one, over the file a reset just deleted, or over
 * one the banner just restored. Closing it leaves the file to the commands.
 */
export const holdLockedSettings = async (
  root: MainRoot,
  store: SettingsFileHandle
) => {
  try {
    await store.close();
  } catch (error) {
    console.error('Failed to close the locked settings file:', error);
  }

  if (root.appSettings.settingsLockReason === 'corrupt') {
    root.appSettings.setLastGoodSettingsSavedAt(await findLastGoodSettings());
  }
};

/**
 * The one way settings reach disk. Locked settings never write — a file this
 * build could not migrate must survive the session untouched.
 */
export const createSaveHandle =
  (root: MainRoot, store: SettingsFileHandle) => (): Promise<void> =>
    root.appSettings.settingsLocked
      ? Promise.resolve()
      : saveSettings(store, root);
