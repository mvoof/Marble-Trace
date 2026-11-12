import {
  backupSettingsFile,
  findLastGoodSettings,
  keepLastGoodSettings,
  hydrateStores,
  saveSettings,
  type Settings,
} from './persistence';
import type { LoadedSettingsFile } from '@shared/api/settings.service';
import { runMigrations } from '@shared/settings-schema/migrate';
import type { MigrationResult } from '@shared/settings-schema/types';
import type { MainRoot } from '@app/roots/main-root';

/**
 * Settings-file bootstrap. Main's alone: it is the only window that reads the
 * file — every other one is sent a snapshot (ADR-0007).
 *
 * Ordering contract: everything here runs *before* any reaction is registered.
 * `loadSettings` → `hydrateFromDisk` → (caller checks `settingsLocked`) →
 * `createSaveHandle`. Registering a save reaction before hydration would write
 * defaults over the user's file within a second of start.
 */

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
  loaded: LoadedSettingsFile
) => {
  // No file is a first start: the stores keep their defaults and the first
  // save writes them. A file that is there but unreadable is the opposite —
  // seeding defaults over it overwrites exactly the file this path protects.
  if (loaded.status === 'missing') {
    return;
  }

  if (loaded.status === 'unreadable') {
    console.error('Settings locked: present on disk but could not be read');
    root.appSettings.lockSettings('corrupt');

    return;
  }

  // A migration step reads shapes that no current type describes, straight out
  // of a file the user may have hand-edited. A step that throws on one would
  // otherwise take the whole window down with it — no hydration, but no lock
  // and no banner either, which is the one outcome this path exists to avoid.
  let result: MigrationResult;

  try {
    result = runMigrations(loaded.settings);
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
 * Offers the way back from a locked file when there is one: a corrupt file
 * whose last good copy is still on disk. Nothing writes a locked file — no save
 * reaction is registered, and the backend writes nothing on exit.
 */
export const offerLastGoodSettings = async (root: MainRoot) => {
  if (root.appSettings.settingsLockReason === 'corrupt') {
    root.appSettings.setLastGoodSettingsSavedAt(await findLastGoodSettings());
  }
};

/**
 * The one way settings reach disk. Locked settings never write — a file this
 * build could not migrate must survive the session untouched.
 *
 * Saves run one after another, each building the settings when its turn comes:
 * the reaction, the monitor watch and the close handler may all ask at once,
 * and an older snapshot must not land after a newer one.
 */
export const createSaveHandle = (root: MainRoot) => {
  let queue: Promise<void> = Promise.resolve();

  const saveUnlessLocked = (): Promise<void> =>
    root.appSettings.settingsLocked ? Promise.resolve() : saveSettings(root);

  return (): Promise<void> => {
    const save = queue.then(saveUnlessLocked);

    queue = save.catch(() => undefined);

    return save;
  };
};
