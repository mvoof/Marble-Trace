import { runInAction } from 'mobx';
import { DEFAULT_WIDGETS } from '@store/widget-defaults';
import type { UnitSystem } from '@/types';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import type { AppSettings } from '@store/app-settings.store';
import { filterToDefaults } from '@utils/filter-to-defaults';
import type { RootStore } from '../root-store';

export const SETTINGS_FILE = 'settings.json';

export interface Settings {
  app: AppSettings;
  units: {
    system: UnitSystem;
  };
  widgets: WidgetDefaultConfig[];
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

    const mergedUserSettings = filterToDefaults(
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
  });
};

interface Store {
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

export const saveSettings = async (store: Store, root: RootStore) => {
  await store.set('settings', {
    app: { ...root.appSettings.settings },
    units: {
      system: root.units.unitSystem,
    },
    widgets: root.widgetSettings.allWidgets,
  });

  await store.save();
};
