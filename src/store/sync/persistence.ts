import { runInAction } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
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
import {
  migrateBindings,
  stripLegacyHotkeyFields,
} from '@store/hotkeys/migration';
import type { InputDevice } from '@/types/bindings';

export const SETTINGS_FILE = 'settings.json';

export interface Settings {
  app: AppSettings;
  units: {
    system: UnitSystem;
  };
  widgets: WidgetDefaultConfig[];
  defaultWidgets: WidgetDefaultConfig[];
  layouts: SavedLayout[];
  activeLayoutId: string | null;
  sessionLayouts?: Record<SessionContext, string | null>;
  /** App-level input bindings. Deliberately outside `layouts` — see hotkeys/migration.ts. */
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

// Steering lock used to be an Input Trace widget setting before it became an
// app-wide one. Settings files written by older builds carry the user's value
// only there, so it is lifted into the app settings on first load.
const legacySteeringLock = (loadedSettings: Partial<Settings>) => {
  if (loadedSettings.app?.steeringLock !== undefined) {
    return undefined;
  }

  const inputTrace = loadedSettings.widgets?.find(
    (widget) => widget.id === 'input-trace'
  );
  const savedLock = (inputTrace?.userSettings as { steeringLimit?: number })
    ?.steeringLimit;

  return typeof savedLock === 'number' ? savedLock : undefined;
};

export const hydrateStores = (
  root: RootStore,
  loadedSettings: Partial<Settings>
) => {
  runInAction(() => {
    const migratedLock = legacySteeringLock(loadedSettings);

    root.appSettings.applySettings(loadedSettings.app ?? {});

    if (migratedLock !== undefined) {
      root.appSettings.setSteeringLock(migratedLock);
    }

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

    hydrateBindings(root, loadedSettings);

    if (loadedSettings.inputDevices) {
      root.deviceInput.setKnownDevices(loadedSettings.inputDevices);
    }
  });
};

/**
 * Bindings either come from the file, or — on the first run after the upgrade —
 * are lifted out of the per-layout `*Hotkey` fields. The one-shot flag lives in
 * app settings so a user who deliberately clears every binding does not get the
 * old ones back on the next launch.
 */
const hydrateBindings = (
  root: RootStore,
  loadedSettings: Partial<Settings>
) => {
  if (root.appSettings.appSettings.bindingsMigrated) {
    root.bindings.applyBindings(loadedSettings.bindings);

    return;
  }

  const migrated = migrateBindings({
    appSettings: loadedSettings.app as Record<string, unknown> | undefined,
    layouts: root.widgetSettings.layouts,
    activeLayoutId: root.widgetSettings.activeLayoutId,
  });

  root.bindings.applyBindings({
    ...migrated,
    ...(loadedSettings.bindings ?? {}),
  });

  stripLegacyHotkeyFields(root.widgetSettings.layouts);

  root.appSettings.appSettings.bindingsMigrated = true;
};

interface Store {
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

export const buildSettings = (root: RootStore): Settings => ({
  app: { ...root.appSettings.appSettings },
  units: {
    system: root.units.unitSystem,
  },
  widgets: root.widgetSettings.allWidgets,
  defaultWidgets: Array.from(root.widgetSettings.defaultWidgets.values()),
  layouts: root.widgetSettings.layouts,
  activeLayoutId: root.widgetSettings.activeLayoutId,
  sessionLayouts: root.widgetSettings.sessionLayouts,
  bindings: root.bindings.bindings,
  inputDevices: root.deviceInput.knownDevices,
});

export const saveSettings = async (store: Store, root: RootStore) => {
  const settings = buildSettings(root);

  await store.set('settings', settings);
  await store.save();
};

export const logSettingsSnapshot = async (root: RootStore) => {
  await invoke('log_settings_snapshot', { settings: buildSettings(root) });
};
