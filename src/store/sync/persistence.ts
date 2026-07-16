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
  });
};

interface Store {
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

export const saveSettings = async (store: Store, root: RootStore) => {
  const settings: Settings = {
    app: { ...root.appSettings.appSettings },
    units: {
      system: root.units.unitSystem,
    },
    widgets: root.widgetSettings.allWidgets,
    defaultWidgets: Array.from(root.widgetSettings.defaultWidgets.values()),
    layouts: root.widgetSettings.layouts,
    activeLayoutId: root.widgetSettings.activeLayoutId,
    sessionLayouts: root.widgetSettings.sessionLayouts,
  };

  await store.set('settings', settings);
  await store.save();

  void invoke('log_settings_snapshot', { settings });
};
