import { runInAction } from 'mobx';
import { appSettingsStore } from '../app-settings.store';
import { unitsStore } from '../units.store';
import { widgetSettingsStore } from '../widget-settings.store';
import { DEFAULT_WIDGETS } from '../widget-defaults';
import type { UnitSystem } from '../../types';
import type {
  WidgetDefaultConfig,
  WidgetSpecificSettings,
} from '../../types/widget-settings';
import type { AppSettings } from '../app-settings.store';
import { filterToDefaults } from '../../utils/filter-to-defaults';

export const SETTINGS_FILE = 'settings.json';

export interface Settings {
  app: AppSettings;
  units: {
    system: UnitSystem;
  };
  widgets: WidgetDefaultConfig[];
}

const overlayWidgetSpecificSettings = (
  defaults: WidgetSpecificSettings | undefined,
  saved: WidgetSpecificSettings | undefined
): WidgetSpecificSettings | undefined => {
  if (!defaults) {
    return undefined;
  }

  if (!saved) {
    return defaults;
  }

  return filterToDefaults(defaults, saved) as WidgetSpecificSettings;
};

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

    const filteredSaved = filterToDefaults(widgetDefaults, saved);

    result.push({
      ...filteredSaved,
      label: widgetDefaults.label,
      description: widgetDefaults.description,
      widgetSpecificSettings: overlayWidgetSpecificSettings(
        widgetDefaults.widgetSpecificSettings,
        saved.widgetSpecificSettings
      ),
    });
  }

  const savedIds = new Set(savedWidgets.map((widget) => widget.id));
  const unseenWidgets = DEFAULT_WIDGETS.filter(
    (widget) => !savedIds.has(widget.id)
  );

  return [...result, ...unseenWidgets];
};

export const hydrateStores = (loadedSettings: Partial<Settings>) => {
  runInAction(() => {
    appSettingsStore.applySettings(loadedSettings.app ?? {});

    if (loadedSettings.units) {
      unitsStore.setSystem(loadedSettings.units.system);
    }

    widgetSettingsStore.setWidgets(
      loadedSettings.widgets
        ? restoreWidgets(loadedSettings.widgets)
        : DEFAULT_WIDGETS
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
