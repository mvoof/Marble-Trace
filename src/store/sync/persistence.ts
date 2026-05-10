import { runInAction } from 'mobx';
import { appSettingsStore } from '../app-settings.store';
import { unitsStore } from '../units.store';
import { widgetSettingsStore } from '../widget-settings.store';
import { DEFAULT_WIDGETS } from '../widget-defaults';
import type { UnitSystem } from '../../types';
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
    if (
      key in defaults &&
      typeof saved[key] === 'object' &&
      saved[key] !== null
    ) {
      (merged as Record<string, unknown>)[key] = {
        ...(defaults[key] as object),
        ...(saved[key] as object),
      };
    }
  }

  return merged;
};

// Permanent registry: maps obsolete widget IDs to their current replacements.
// Add an entry here whenever a widget ID is renamed — never remove old entries,
// because users may still have the old ID persisted in their settings.json.
const ID_MIGRATIONS: Record<string, string> = {
  flags: 'led-flags',
  'linear-map': 'relative-map',
};

const migrateWidget = (widget: WidgetConfig): WidgetConfig => {
  const newId = ID_MIGRATIONS[widget.id];
  if (!newId) return widget;

  const oldValue =
    widget.customSettings?.[widget.id as keyof WidgetCustomSettings];
  const customSettings = widget.customSettings
    ? { [newId]: oldValue, ...widget.customSettings }
    : widget.customSettings;

  return { ...widget, id: newId, customSettings };
};

const mergeWidgets = (savedWidgets: WidgetConfig[]): WidgetConfig[] => {
  const migrated = savedWidgets.map(migrateWidget);
  const defaultById = new Map(DEFAULT_WIDGETS.map((w) => [w.id, w]));

  const merged: WidgetConfig[] = [];

  for (const saved of migrated) {
    const defaultWidget = defaultById.get(saved.id);
    if (!defaultWidget) continue;

    merged.push({
      ...defaultWidget,
      ...saved,
      label: defaultWidget.label,
      description: defaultWidget.description,
      customSettings: mergeCustomSettings(
        defaultWidget.customSettings,
        saved.customSettings
      ),
    });
  }

  const savedIds = new Set(migrated.map((w) => w.id));
  const newWidgets = DEFAULT_WIDGETS.filter((w) => !savedIds.has(w.id));

  return [...merged, ...newWidgets];
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
