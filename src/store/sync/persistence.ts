import { runInAction } from 'mobx';
import { appSettingsStore } from '../app-settings.store';
import { unitsStore } from '../units.store';
import { widgetSettingsStore } from '../widget-settings.store';
import type { UnitSystem } from '../../types/units';
import type { WidgetConfig } from '../../types/widget-settings';

export const SETTINGS_FILE = 'settings.json';

export interface Settings {
  app: {
    dragHotkey: string;
    hideAllWidgetsHotkey: string;
    hideWidgetsWhenGameClosed: boolean;
    hideAllWidgets: boolean;
  };
  units: {
    system: UnitSystem;
  };
  widgets: WidgetConfig[];
}

export const hydrateStores = (saved: Settings) => {
  runInAction(() => {
    if (saved.app) {
      appSettingsStore.setDragHotkey(saved.app.dragHotkey);
      if (saved.app.hideAllWidgetsHotkey) {
        appSettingsStore.setHideAllWidgetsHotkey(
          saved.app.hideAllWidgetsHotkey
        );
      }
      appSettingsStore.setHideWidgetsWhenGameClosed(
        saved.app.hideWidgetsWhenGameClosed
      );
      appSettingsStore.setHideAllWidgets(saved.app.hideAllWidgets);
    }
    if (saved.units) {
      unitsStore.setSystem(saved.units.system);
    }
    if (saved.widgets) {
      widgetSettingsStore.setWidgets(saved.widgets);
    }
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
    },
    units: {
      system: unitsStore.system,
    },
    widgets: widgetSettingsStore.allWidgets,
  });
  await store.save();
};
