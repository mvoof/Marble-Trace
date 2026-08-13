import { runInAction } from 'mobx';
import {
  backupSettingsFile as backupSettingsFileCommand,
  logSettingsSnapshot as logSettingsSnapshotCommand,
  settingsFileExists as settingsFileExistsCommand,
} from '@/services/settings.service';
import { DEFAULT_WIDGETS } from '@store/widget-defaults';
import type { UnitSystem } from '@/types';
import type {
  SavedLayout,
  WidgetDefaultConfig,
  SessionContext,
} from '@/types/widget-settings';
import type { AppSettings } from '@store/settings/app-settings.store';
import { mergeWithDefaults } from '@utils/deep-merge';
import type { RootStore } from '@store/root-store';
import type { BindingMap } from '@store/hotkeys/binding-types';
import { CURRENT_SCHEMA_VERSION } from '@store/settings-schema';
import type { InputDevice } from '@/types/bindings';

export const SETTINGS_FILE = 'settings.json';

export interface Settings {
  /**
   * Format version of this file, stamped on every save. Absent means a file
   * written before 0.21. See `store/settings-schema` — never compare it to the
   * app's semver.
   */
  schemaVersion: number;
  app: AppSettings;
  units: {
    system: UnitSystem;
  };
  widgets: WidgetDefaultConfig[];
  defaultWidgets: WidgetDefaultConfig[];
  layouts: SavedLayout[];
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

const restoreWidgets = (
  savedWidgets: WidgetDefaultConfig[]
): WidgetDefaultConfig[] => {
  const defaultById = new Map(
    DEFAULT_WIDGETS.map((widget) => [widget.id, widget])
  );

  const result: WidgetDefaultConfig[] = [];

  for (const saved of savedWidgets) {
    const widgetDefaults = defaultById.get(saved.id);

    if (!widgetDefaults) continue;

    const mergedUserSettings = mergeWithDefaults(
      widgetDefaults.userSettings,
      saved.userSettings ?? {}
    );

    result.push({
      id: widgetDefaults.id,
      label: widgetDefaults.label,
      description: widgetDefaults.description,
      designWidth: saved.designWidth ?? widgetDefaults.designWidth,
      designHeight: saved.designHeight ?? widgetDefaults.designHeight,
      userSettings: mergedUserSettings,
    });
  }

  const savedIds = new Set(savedWidgets.map((widget) => widget.id));
  const unseenWidgets = DEFAULT_WIDGETS.filter(
    (widget) => !savedIds.has(widget.id)
  );

  return [...result, ...unseenWidgets];
};

/**
 * Fills the stores from a settings blob that has already been brought to the
 * current schema by `runMigrations`. Nothing here knows about older formats —
 * that is the migration chain's job, and keeping it there is what makes it
 * testable against a real old file.
 */
export const hydrateStores = (
  root: RootStore,
  loadedSettings: Partial<Settings>
) => {
  runInAction(() => {
    root.appSettings.applySettings(loadedSettings.app ?? {});

    if (loadedSettings.units) {
      root.units.setSystem(loadedSettings.units.system);
    }

    root.widgetSettings.setWidgets(
      loadedSettings.widgets
        ? restoreWidgets(loadedSettings.widgets)
        : DEFAULT_WIDGETS
    );

    if (loadedSettings.defaultWidgets) {
      root.widgetSettings.setDefaultWidgets(
        restoreWidgets(loadedSettings.defaultWidgets)
      );
    }

    if (loadedSettings.layouts) {
      root.widgetSettings.setLayouts(
        loadedSettings.layouts,
        loadedSettings.activeLayoutId ?? null
      );
    }

    if (loadedSettings.sessionLayouts) {
      root.widgetSettings.setSessionLayouts(loadedSettings.sessionLayouts);
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

export const buildSettings = (root: RootStore): Settings => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  app: { ...root.appSettings.appSettings },
  units: {
    system: root.units.unitSystem,
  },
  widgets: root.widgetSettings.allWidgets,
  defaultWidgets: Array.from(root.widgetSettings.defaultWidgets.values()),
  layouts: root.widgetSettings.layouts,
  activeLayoutId: root.widgetSettings.activeLayoutId,
  sessionLayouts: root.widgetSettings.sessionLayouts,
  bindings: root.bindings.overrides,
  inputDevices: root.deviceInput.knownDevices,
});

export const saveSettings = async (store: Store, root: RootStore) => {
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

export const logSettingsSnapshot = async (root: RootStore) => {
  await logSettingsSnapshotCommand(buildSettings(root));
};
