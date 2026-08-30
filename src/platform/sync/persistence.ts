import { runInAction } from 'mobx';
import {
  backupSettingsFile as backupSettingsFileCommand,
  logSettingsSnapshot as logSettingsSnapshotCommand,
  settingsFileExists as settingsFileExistsCommand,
} from '@platform/services/settings.service';
import { DEFAULT_WIDGETS, WIDGET_BY_ID } from '@store/widget-catalog';
import type { UnitSystem } from '@/types';
import type {
  SavedLayout,
  WidgetDefaultConfig,
  SessionContext,
} from '@/types/widget-settings';
import type { AppSettings } from '@store/settings/app-settings.store';
import { mergeWithDefaults } from '@store/deep-merge';
import type { RootStore } from '@store/root-store';
import type { BindingMap } from '@/types/input-bindings';
import { CURRENT_SCHEMA_VERSION } from '@platform/settings-schema/index';
import type { InputDevice } from '@/types/bindings';

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
   * The widget templates a new layout is built from. The widgets a driver
   * actually sees live in `layouts[].widgets[]` and nowhere else — the active
   * layout owns them.
   */
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

    const hasLockedRatio =
      !!widgetDefaults.lockAspectRatio && widgetDefaults.designWidth > 0;

    // A locked ratio is part of the widget's shape, not a resize preference:
    // a file written before the widget locked it (or edited by hand) would
    // otherwise render at a size the widget cannot draw.
    if (hasLockedRatio) {
      const ratio = widgetDefaults.designHeight / widgetDefaults.designWidth;

      mergedUserSettings.currentHeight = Math.round(
        mergedUserSettings.currentWidth * ratio
      );
    }

    // A saved design size only means something for widgets that recompute it
    // from their visible columns; for a locked ratio it *is* the ratio, so a
    // stale pair from an older shape has to give way to the manifest — kept,
    // it stretches the widget back into that shape on the next resize.
    // A table whose width *is* the sum of its columns derives it rather than
    // remembering it: a stored width from an older column set would survive as
    // dead space at the right edge of every row. The widget keeps the size the
    // user gave it — `currentWidth` is rescaled by the same factor, so `--wfs`,
    // and with it the text, does not move.
    const deriveDesignWidth = WIDGET_BY_ID.get(saved.id)?.deriveDesignWidth;
    let normalizedDesignWidth: number | null = null;

    if (!hasLockedRatio && deriveDesignWidth) {
      const derivedWidth = Math.max(1, deriveDesignWidth(mergedUserSettings));
      const storedWidth = saved.designWidth ?? widgetDefaults.designWidth;

      if (storedWidth > 0 && derivedWidth !== storedWidth) {
        mergedUserSettings.currentWidth = Math.round(
          (mergedUserSettings.currentWidth / storedWidth) * derivedWidth
        );
      }

      normalizedDesignWidth = derivedWidth;
    }

    const designWidth = hasLockedRatio
      ? widgetDefaults.designWidth
      : (normalizedDesignWidth ??
        saved.designWidth ??
        widgetDefaults.designWidth);

    const designHeight = hasLockedRatio
      ? widgetDefaults.designHeight
      : (saved.designHeight ?? widgetDefaults.designHeight);

    result.push({
      id: widgetDefaults.id,
      label: widgetDefaults.label,
      description: widgetDefaults.description,
      designWidth,
      designHeight,
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
 * The same repair for the widgets a layout carries. Since the active layout owns
 * the widgets outright, these are the only copies a driver actually sees; a
 * layout holds every widget, enabled or not (`snapshotWidgets` in the widget
 * settings store), so a widget the file has never seen belongs here as much as
 * it does in `defaultWidgets`.
 *
 * Without this pass every layout keeps whatever shape it was written with. A
 * setting added to an already-shipped widget then reads as `undefined` in each
 * layout — `false` for a boolean — which is the opposite of its default, and it
 * happens silently on the first layout switch. That gap is why anything touching
 * `layouts[].widgets[]` used to need a migration step of its own.
 *
 * A widget the layout never had is forced to `enabled: false` regardless of what
 * it ships as: filling a hole in an old file must not put a new widget on
 * someone's overlay by itself.
 */
export const restoreLayoutWidgets = (
  savedWidgets: WidgetDefaultConfig[]
): WidgetDefaultConfig[] => {
  const savedIds = new Set(savedWidgets.map((widget) => widget.id));

  return restoreWidgets(savedWidgets).map((widget) =>
    savedIds.has(widget.id)
      ? widget
      : {
          ...widget,
          userSettings: { ...widget.userSettings, enabled: false },
        }
  );
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

    if (loadedSettings.defaultWidgets) {
      root.widgetDefaults.setWidgets(
        restoreWidgets(loadedSettings.defaultWidgets)
      );
    }

    if (loadedSettings.layouts) {
      root.widgetSettings.setLayouts(
        loadedSettings.layouts.map((layout) => ({
          ...layout,
          widgets: restoreLayoutWidgets(layout.widgets ?? []),
        })),
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
  defaultWidgets: Array.from(root.widgetDefaults.widgets.values()),
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
