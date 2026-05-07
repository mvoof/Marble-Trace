import { runInAction } from 'mobx';
import {
  appSettingsStore,
  DEFAULT_DRAG_HOTKEY,
  DEFAULT_HIDE_ALL_HOTKEY,
  DEFAULT_AUTO_UPDATE,
  DEFAULT_UPDATE_CHECK_INTERVAL,
} from '../app-settings.store';
import { unitsStore } from '../units.store';
import { widgetSettingsStore } from '../widget-settings.store';
import { DEFAULT_WIDGETS } from '../widget-defaults';
import type { UnitSystem } from '../../types/units';
import type {
  WidgetConfig,
  WidgetCustomSettings,
} from '../../types/widget-settings';

export const SETTINGS_FILE = 'settings.json';

export interface Settings {
  app: {
    dragHotkey: string;
    hideAllWidgetsHotkey: string;
    hideWidgetsWhenGameClosed: boolean;
    hideAllWidgets: boolean;
    autoUpdate?: boolean;
    updateCheckInterval?: number;
    lastUpdateCheck?: string;
  };
  units: {
    system: UnitSystem;
  };
  widgets: WidgetConfig[];
}

const mergeCustomSettings = (
  defaults: WidgetCustomSettings | undefined,
  saved: WidgetCustomSettings | undefined
): WidgetCustomSettings | undefined => {
  if (!defaults && !saved) return undefined;
  if (!defaults) return saved;
  if (!saved) return defaults;

  const merged: WidgetCustomSettings = { ...defaults };
  for (const key of Object.keys(saved) as (keyof WidgetCustomSettings)[]) {
    if (key in defaults) {
      (merged as Record<string, unknown>)[key] = {
        ...(defaults[key] as object),
        ...(saved[key] as object),
      };
    }
  }

  return merged;
};

const mergeWidgets = (savedWidgets: WidgetConfig[]): WidgetConfig[] => {
  const savedById = new Map(savedWidgets.map((w) => [w.id, w]));

  return DEFAULT_WIDGETS.map((defaultWidget) => {
    const saved = savedById.get(defaultWidget.id);
    if (!saved) return defaultWidget;

    return {
      ...defaultWidget,
      ...saved,
      customSettings: mergeCustomSettings(
        defaultWidget.customSettings,
        saved.customSettings
      ),
    };
  });
};

export const hydrateStores = (saved: Partial<Settings>) => {
  runInAction(() => {
    const app: Partial<Settings['app']> = saved.app ?? {};

    appSettingsStore.setDragHotkey(app.dragHotkey ?? DEFAULT_DRAG_HOTKEY);
    appSettingsStore.setHideAllWidgetsHotkey(
      app.hideAllWidgetsHotkey ?? DEFAULT_HIDE_ALL_HOTKEY
    );
    appSettingsStore.setHideWidgetsWhenGameClosed(
      app.hideWidgetsWhenGameClosed ?? false
    );
    appSettingsStore.setHideAllWidgets(app.hideAllWidgets ?? false);
    appSettingsStore.setAutoUpdate(app.autoUpdate ?? DEFAULT_AUTO_UPDATE);
    appSettingsStore.setUpdateCheckInterval(
      app.updateCheckInterval ?? DEFAULT_UPDATE_CHECK_INTERVAL
    );
    if (app.lastUpdateCheck) {
      appSettingsStore.setLastUpdateCheck(app.lastUpdateCheck);
    }

    if (saved.units) {
      unitsStore.setSystem(saved.units.system);
    }

    widgetSettingsStore.setWidgets(
      saved.widgets ? mergeWidgets(saved.widgets) : DEFAULT_WIDGETS
    );
  });
};

interface Store {
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

export const saveSettings = async (store: Store) => {
  await store.set('settings', {
    app: {
      dragHotkey: appSettingsStore.dragHotkey,
      hideAllWidgetsHotkey: appSettingsStore.hideAllWidgetsHotkey,
      hideWidgetsWhenGameClosed: appSettingsStore.hideWidgetsWhenGameClosed,
      hideAllWidgets: appSettingsStore.hideAllWidgets,
      autoUpdate: appSettingsStore.autoUpdate,
      updateCheckInterval: appSettingsStore.updateCheckInterval,
      lastUpdateCheck: appSettingsStore.lastUpdateCheck,
    },
    units: {
      system: unitsStore.system,
    },
    widgets: widgetSettingsStore.allWidgets,
  });
  await store.save();
};
