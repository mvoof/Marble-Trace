import { runInAction } from 'mobx';
import {
  backupSettingsFile as backupSettingsFileCommand,
  logSettingsSnapshot as logSettingsSnapshotCommand,
  settingsFileExists as settingsFileExistsCommand,
} from '@shared/api/settings.service';
import type { UnitSystem } from '@shared/contracts/domain';
import type { SessionContext } from '@entities/widget/widget-settings';
import type { AppSettings } from '@entities/app-settings/app-settings.store';
import type { MainRoot } from '@store/roots/main-root';
import type { BindingMap } from '@shared/contracts/input-bindings';
import { CURRENT_SCHEMA_VERSION } from '@shared/settings-schema/index';
import type { InputDevice } from '@shared/contracts/bindings';
import {
  decodeLayout,
  decodeTemplates,
  encodeLayout,
  encodeTemplates,
  type StoredLayout,
  type StoredTemplate,
} from '@platform/sync/settings-file';

export const SETTINGS_FILE = 'settings.json';

export interface Settings {
  /**
   * Format version of this file, stamped on every save. Absent means a file
   * written before 0.21. See `platform/settings-schema` — never compare it to the
   * app's semver.
   */
  schemaVersion: number;
  app: AppSettings;
  units: {
    system: UnitSystem;
  };
  /**
   * What a new widget instance starts from, keyed by widget type — the
   * catalogue the Widgets page edits. A new layout's starter set is built from
   * it. The widgets a driver actually sees live in `layouts[].monitors[]` and
   * nowhere else.
   */
  widgetTemplates: Record<string, StoredTemplate>;
  layouts: StoredLayout[];
  activeLayoutId: string | null;
  sessionLayouts?: Record<SessionContext, string | null>;
  /**
   * App-level input bindings, and only the ones the user changed — an action
   * absent here takes the registry default. Deliberately outside `layouts`: one
   * set of keys covers every layout.
   */
  bindings?: BindingMap;
  /** Devices seen before, so an unplugged one's bindings stay identifiable. */
  inputDevices?: InputDevice[];
}

/**
 * Fills the stores from a settings blob that has already been brought to the
 * current schema by `runMigrations`. Nothing here knows about older formats —
 * that is the migration chain's job, and keeping it there is what makes it
 * testable against a real old file.
 */
export const hydrateStores = (
  root: MainRoot,
  loadedSettings: Partial<Settings>
) => {
  runInAction(() => {
    root.appSettings.applySettings(loadedSettings.app ?? {});

    if (loadedSettings.units) {
      root.units.setSystem(loadedSettings.units.system);
    }

    if (loadedSettings.widgetTemplates) {
      root.widgetDefaults.setWidgets(
        decodeTemplates(loadedSettings.widgetTemplates)
      );
    }

    if (loadedSettings.layouts) {
      root.liveWidgets.setLayouts(
        loadedSettings.layouts.map(decodeLayout),
        loadedSettings.activeLayoutId ?? null
      );
    }

    if (loadedSettings.sessionLayouts) {
      root.layouts.setSessionLayouts(loadedSettings.sessionLayouts);
    }

    root.bindings.applyBindings(loadedSettings.bindings);

    if (loadedSettings.inputDevices) {
      root.deviceInput.setKnownDevices(loadedSettings.inputDevices);
    }
  });
};

interface Store {
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

export const buildSettings = (root: MainRoot): Settings => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  app: { ...root.appSettings.appSettings },
  units: {
    system: root.units.unitSystem,
  },
  widgetTemplates: encodeTemplates(root.widgetDefaults.widgets.values()),
  layouts: root.layouts.layouts.map(encodeLayout),
  activeLayoutId: root.layouts.liveLayoutId,
  sessionLayouts: root.layouts.sessionLayouts,
  bindings: root.bindings.overrides,
  inputDevices: root.deviceInput.knownDevices,
});

export const saveSettings = async (store: Store, root: MainRoot) => {
  const settings = buildSettings(root);

  await store.set('settings', settings);
  await store.save();
};

/**
 * Whether a settings file is actually there. The store plugin reports an empty
 * store both for a fresh install and for a file it failed to parse, and those
 * two must not be treated alike.
 *
 * Errs towards "present" when the check itself fails: locking a fresh install
 * by mistake is recoverable in one click, seeding defaults over a file we could
 * not read is not.
 */
export const settingsFileExists = async (): Promise<boolean> => {
  try {
    return await settingsFileExistsCommand();
  } catch (error) {
    console.error('Failed to check for a settings file:', error);

    return true;
  }
};

/**
 * Copies the file aside before a migrated version is written over it. Best
 * effort: an upgrade must not be blocked by a config directory we cannot write
 * a second file into.
 */
export const backupSettingsFile = async (fromVersion: number) => {
  try {
    await backupSettingsFileCommand(`v${fromVersion}`);
  } catch (error) {
    console.error('Failed to back up settings before migrating:', error);
  }
};

export const logSettingsSnapshot = async (root: MainRoot) => {
  await logSettingsSnapshotCommand(buildSettings(root));
};
