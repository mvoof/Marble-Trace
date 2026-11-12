import { runInAction } from 'mobx';
import {
  backupSettingsFile as backupSettingsFileCommand,
  keepLastGoodSettings as keepLastGoodSettingsCommand,
  lastGoodSettingsSavedAt as lastGoodSettingsSavedAtCommand,
  loadSettingsFile,
  logSettingsSnapshot as logSettingsSnapshotCommand,
  saveSettingsFile,
} from '@shared/api/settings.service';
import type { UnitSystem } from '@shared/contracts/domain';
import type { SessionContext } from '@shared/contracts/widget-settings';
import type { AppSettings } from '@entities/app-settings/app-settings.store';
import type { MainRoot } from '@app/roots/main-root';
import type { BindingMap } from '@shared/contracts/input-bindings';
import { CURRENT_SCHEMA_VERSION } from '@shared/settings-schema/migrate';
import type {
  InputDevice,
  LoadedSettings,
} from '@shared/contracts/generated/bindings';
import {
  decodeLayout,
  decodeTemplates,
  encodeLayout,
  encodeTemplates,
  type StoredLayout,
  type StoredTemplate,
} from '@app/sync/main/settings-file';

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

export const saveSettings = async (root: MainRoot) => {
  await saveSettingsFile(buildSettings(root));
};

/**
 * Reads the settings file. A failed read errs towards `unreadable`: locking a
 * fresh install by mistake is recoverable in one click, seeding defaults over
 * a file we could not read is not.
 */
export const loadSettings = async (): Promise<LoadedSettings> => {
  try {
    return await loadSettingsFile();
  } catch (error) {
    console.error('Failed to read the settings file:', error);

    return { status: 'unreadable' };
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

/**
 * Copies a file that loaded and hydrated as it is to `settings.last-good.json`,
 * the copy the lock banner offers back. Best effort: startup must not wait on a
 * second file in the config directory.
 */
export const keepLastGoodSettings = async () => {
  try {
    await keepLastGoodSettingsCommand();
  } catch (error) {
    console.error('Failed to keep a last good copy of the settings:', error);
  }
};

/**
 * When the last-good copy was written, or `null` when there is none — or when
 * the check fails, which leaves the banner as it is without a copy.
 */
export const findLastGoodSettings = async (): Promise<number | null> => {
  try {
    return await lastGoodSettingsSavedAtCommand();
  } catch (error) {
    console.error(
      'Failed to look for a last good copy of the settings:',
      error
    );

    return null;
  }
};

export const logSettingsSnapshot = async (root: MainRoot) => {
  await logSettingsSnapshotCommand(buildSettings(root));
};
