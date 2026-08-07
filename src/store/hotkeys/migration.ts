import type { SavedLayout, WidgetDefaultConfig } from '@/types/widget-settings';
import type { Binding, BindingMap } from './binding-types';
import { ACTION_BY_ID } from './actions';

/**
 * Hotkeys used to live in `WidgetUserSettings`, which is stored per widget
 * inside each layout — so the same key had to be re-entered in every layout and
 * switching layouts silently changed every binding. Bindings are app-level now.
 *
 * Only the active layout's values are taken: they are the ones the user last
 * saw working. Every other layout's copies are dropped rather than merged —
 * merging would resurrect keys the user had deliberately changed.
 */
const LEGACY_WIDGET_HOTKEYS: Array<{
  widgetId: string;
  field: string;
  actionId: string;
}> = [
  {
    widgetId: 'standings',
    field: 'viewModeHotkey',
    actionId: 'standings:cycle-view-mode',
  },
  {
    widgetId: 'standings',
    field: 'classPrevHotkey',
    actionId: 'standings:class-prev',
  },
  {
    widgetId: 'standings',
    field: 'classNextHotkey',
    actionId: 'standings:class-next',
  },
  {
    widgetId: 'standings',
    field: 'scrollUpHotkey',
    actionId: 'standings:scroll-up',
  },
  {
    widgetId: 'standings',
    field: 'scrollDownHotkey',
    actionId: 'standings:scroll-down',
  },
  {
    widgetId: 'pit-service',
    field: 'toggleHotkey',
    actionId: 'pit-service:toggle',
  },
  {
    widgetId: 'pit-service',
    field: 'autoModeHotkey',
    actionId: 'pit-service:auto-mode',
  },
  {
    widgetId: 'pit-service',
    field: 'applyOrderHotkey',
    actionId: 'pit-service:apply-order',
  },
  {
    widgetId: 'pit-service',
    field: 'clearOrderHotkey',
    actionId: 'pit-service:clear-order',
  },
  {
    widgetId: 'pit-service',
    field: 'fuelHotkey',
    actionId: 'pit-service:fuel',
  },
  {
    widgetId: 'pit-service',
    field: 'tiresAllHotkey',
    actionId: 'pit-service:tires-all',
  },
  {
    widgetId: 'pit-service',
    field: 'tireLfHotkey',
    actionId: 'pit-service:tire-lf',
  },
  {
    widgetId: 'pit-service',
    field: 'tireRfHotkey',
    actionId: 'pit-service:tire-rf',
  },
  {
    widgetId: 'pit-service',
    field: 'tireLrHotkey',
    actionId: 'pit-service:tire-lr',
  },
  {
    widgetId: 'pit-service',
    field: 'tireRrHotkey',
    actionId: 'pit-service:tire-rr',
  },
  {
    widgetId: 'pit-service',
    field: 'fastRepairHotkey',
    actionId: 'pit-service:fast-repair',
  },
  {
    widgetId: 'pit-service',
    field: 'windshieldHotkey',
    actionId: 'pit-service:windshield',
  },
];

const LEGACY_APP_HOTKEYS: Array<{ field: string; actionId: string }> = [
  { field: 'dragHotkey', actionId: 'app:toggle-drag-mode' },
  { field: 'interactHotkey', actionId: 'app:toggle-interact-mode' },
  { field: 'hideAllWidgetsHotkey', actionId: 'app:toggle-hide-all-widgets' },
];

/** Every legacy field name, so they can be stripped from persisted layouts. */
export const LEGACY_HOTKEY_FIELDS = new Set(
  LEGACY_WIDGET_HOTKEYS.map((entry) => entry.field)
);

export interface LegacySettingsInput {
  appSettings: Record<string, unknown> | undefined;
  layouts: SavedLayout[];
  activeLayoutId: string | null;
}

const keyboard = (accelerator: string): Binding => ({
  kind: 'keyboard',
  accelerator,
});

const readLegacyField = (
  widgets: WidgetDefaultConfig[] | undefined,
  widgetId: string,
  field: string
): string | null => {
  const settings = widgets?.find((widget) => widget.id === widgetId)
    ?.userSettings as Record<string, unknown> | undefined;

  const value = settings?.[field];

  return typeof value === 'string' && value !== '' ? value : null;
};

/**
 * Builds the app-level binding map from the pre-bindings settings shape.
 * Pure: callers persist the result and strip the legacy fields themselves.
 */
export const migrateBindings = ({
  appSettings,
  layouts,
  activeLayoutId,
}: LegacySettingsInput): BindingMap => {
  const bindings: BindingMap = {};

  const activeLayout =
    layouts.find((layout) => layout.id === activeLayoutId) ?? layouts[0];

  for (const entry of LEGACY_APP_HOTKEYS) {
    const value = appSettings?.[entry.field];

    if (typeof value === 'string' && value !== '') {
      bindings[entry.actionId] = [keyboard(value)];
    }
  }

  for (const entry of LEGACY_WIDGET_HOTKEYS) {
    if (!ACTION_BY_ID.has(entry.actionId)) continue;

    const accelerator = readLegacyField(
      activeLayout?.widgets,
      entry.widgetId,
      entry.field
    );

    if (accelerator) {
      bindings[entry.actionId] = [keyboard(accelerator)];
    }
  }

  return bindings;
};

/**
 * Removes the legacy `*Hotkey` fields from every layout, in place. They are
 * gone from the types, so leaving them in settings.json would only be dead
 * weight that `mergeWithDefaults` carries forward forever.
 */
export const stripLegacyHotkeyFields = (layouts: SavedLayout[]) => {
  for (const layout of layouts) {
    for (const widget of layout.widgets ?? []) {
      const settings = widget.userSettings as unknown as Record<
        string,
        unknown
      >;

      for (const field of LEGACY_HOTKEY_FIELDS) {
        delete settings[field];
      }
    }
  }
};
