import { runInAction } from 'mobx';
import { appSettingsStore } from '../app-settings.store';
import { unitsStore } from '../units.store';
import { widgetSettingsStore } from '../widget-settings.store';
import { DEFAULT_WIDGETS } from '../widget-defaults';
import type { UnitSystem } from '../../types/units';
import type {
  WidgetConfig,
  WidgetCustomSettings,
} from '../../types/widget-settings';
import type { AppSettings } from '../app-settings.store';

export const SETTINGS_FILE = 'settings.json';

export interface Settings {
  app: AppSettings;
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
    appSettingsStore.applySettings(saved.app ?? {});

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
    app: { ...appSettingsStore.settings },
    units: {
      system: unitsStore.system,
    },
    widgets: widgetSettingsStore.allWidgets,
  });
  await store.save();
};
