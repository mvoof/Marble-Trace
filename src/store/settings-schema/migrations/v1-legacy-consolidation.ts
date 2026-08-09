import type { Migration, SettingsBlob } from '../types';

/**
 * v0 → v1. Consolidates every format change made before 0.21, so that
 * afterwards the schema chain is the project's only migration mechanism.
 *
 * Before: layouts came in three shapes (per-monitor `monitorConfigs`,
 * `targetResolution` + `targetMonitorName`, or already flat); keyboard
 * shortcuts lived in `userSettings.*Hotkey` inside every widget of every
 * layout, plus three in `app`; the wheel's rotation range lived in the input
 * trace widget as `steeringLimit`.
 *
 * After: one flat layout shape with `monitors[]` and `backgroundImages`;
 * app-level `bindings` holding only what the user changed; `app.steeringLock`.
 *
 * NOTHING HERE MAY IMPORT LIVE TYPES, DEFAULTS OR REGISTRIES. Every table below
 * is frozen as it was at 0.21 on purpose — a step that reads today's registry
 * rewrites history by tomorrow's rules. Unknown action ids are harmless: the
 * bindings store keeps them and simply ignores them.
 */

interface LegacyWidget {
  id?: string;
  userSettings?: Record<string, unknown>;
}

interface LegacyLayout {
  id?: string;
  name?: string;
  createdAt?: number;
  monitors?: unknown;
  widgets?: LegacyWidget[];
  monitorConfigs?: Record<string, LegacyMonitorConfig>;
  targetResolution?: { width: number; height: number };
  targetMonitorName?: string;
  backgroundImage?: string;
  backgroundImages?: Record<string, string>;
}

interface LegacyMonitorConfig {
  resolution: { width: number; height: number };
  widgets: LegacyWidget[];
}

const WIDGET_HOTKEYS: Array<{
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

const APP_HOTKEYS: Array<{ field: string; actionId: string }> = [
  { field: 'dragHotkey', actionId: 'app:toggle-drag-mode' },
  { field: 'interactHotkey', actionId: 'app:toggle-interact-mode' },
  { field: 'hideAllWidgetsHotkey', actionId: 'app:toggle-hide-all-widgets' },
];

/** Widget-level fields v1 removes once their values have been lifted. */
const DEAD_WIDGET_FIELDS = [
  ...WIDGET_HOTKEYS.map((entry) => entry.field),
  'steeringLimit',
];

const DEAD_APP_FIELDS = [
  ...APP_HOTKEYS.map((entry) => entry.field),
  'bindingsMigrated',
];

const STEERING_LOCK_WIDGET = 'input-trace';

const asObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const readHotkey = (
  widgets: LegacyWidget[],
  widgetId: string,
  field: string
): string | null => {
  const value = widgets.find((widget) => widget.id === widgetId)
    ?.userSettings?.[field];

  return typeof value === 'string' && value !== '' ? value : null;
};

/**
 * Flattens one layout into the virtual-desktop shape. Ported unchanged from
 * `migrateLayout`, which used to run inside the store on every single load.
 *
 * Both older shapes stored widget coordinates relative to a single screen.
 * Placing them correctly needs each monitor's real desktop position, which only
 * the OS knows, so screens are laid out side by side here; the runtime's
 * `alignMonitorsToHardware` moves them onto the real desktop afterwards. That
 * half stays in the store — it is not a format change and cannot be pure.
 */
const normalizeLayout = (layout: LegacyLayout): LegacyLayout => {
  if (Array.isArray(layout.monitors)) {
    return layout;
  }

  const base = {
    id: layout.id,
    name: layout.name,
    createdAt: layout.createdAt,
  };

  const legacyBackground = layout.backgroundImage;

  if (layout.monitorConfigs) {
    const monitors: Array<{
      name: string;
      bounds: { x: number; y: number; width: number; height: number };
    }> = [];
    const widgets: LegacyWidget[] = [];
    const backgroundImages: Record<string, string> = {};
    let offsetX = 0;

    for (const [name, config] of Object.entries(layout.monitorConfigs)) {
      monitors.push({
        name,
        bounds: {
          x: offsetX,
          y: 0,
          width: config.resolution.width,
          height: config.resolution.height,
        },
      });

      for (const widget of config.widgets) {
        widgets.push({
          ...widget,
          userSettings: {
            ...widget.userSettings,
            x: (widget.userSettings?.['x'] as number) + offsetX,
          },
        });
      }

      if (legacyBackground) {
        backgroundImages[name] = legacyBackground;
      }

      offsetX += config.resolution.width;
    }

    return { ...base, monitors, widgets, backgroundImages };
  }

  const { targetResolution, targetMonitorName } = layout;

  return {
    ...base,
    monitors:
      targetResolution && targetMonitorName
        ? [
            {
              name: targetMonitorName,
              bounds: {
                x: 0,
                y: 0,
                width: targetResolution.width,
                height: targetResolution.height,
              },
            },
          ]
        : [],
    widgets: layout.widgets ?? [],
    backgroundImages:
      legacyBackground && targetMonitorName
        ? { [targetMonitorName]: legacyBackground }
        : {},
  };
};

const stripWidgetFields = (widgets: LegacyWidget[]): LegacyWidget[] =>
  widgets.map((widget) => {
    const userSettings = { ...widget.userSettings };

    for (const field of DEAD_WIDGET_FIELDS) {
      delete userSettings[field];
    }

    return { ...widget, userSettings };
  });

const migrate = (blob: SettingsBlob): SettingsBlob => {
  // Order is load-bearing. A `monitorConfigs`-era layout has no `widgets` key at
  // all — its widgets are nested per monitor — so reading hotkeys before the
  // shape is flattened silently finds nothing and loses every binding.
  const layouts = asArray<LegacyLayout>(blob['layouts']).map(normalizeLayout);

  const app = { ...(asObject(blob['app']) ?? {}) };
  const topWidgets = asArray<LegacyWidget>(blob['widgets']);

  const activeLayout =
    layouts.find((layout) => layout.id === blob['activeLayoutId']) ??
    layouts[0];
  const activeWidgets = activeLayout?.widgets ?? [];

  // Only the active layout's keys are taken: they are the ones the user last saw
  // working. Other layouts' copies are dropped rather than merged — merging
  // would resurrect keys the user had deliberately changed.
  const bindings: Record<
    string,
    Array<{ kind: 'keyboard'; accelerator: string }>
  > = {
    ...(asObject(blob['bindings']) as typeof bindings | undefined),
  };

  for (const entry of APP_HOTKEYS) {
    const value = app[entry.field];

    if (
      typeof value === 'string' &&
      value !== '' &&
      !bindings[entry.actionId]
    ) {
      bindings[entry.actionId] = [{ kind: 'keyboard', accelerator: value }];
    }
  }

  for (const entry of WIDGET_HOTKEYS) {
    const accelerator = readHotkey(activeWidgets, entry.widgetId, entry.field);

    if (accelerator && !bindings[entry.actionId]) {
      bindings[entry.actionId] = [{ kind: 'keyboard', accelerator }];
    }
  }

  if (app['steeringLock'] === undefined) {
    const savedLock = topWidgets.find(
      (widget) => widget.id === STEERING_LOCK_WIDGET
    )?.userSettings?.['steeringLimit'];

    if (typeof savedLock === 'number') {
      app['steeringLock'] = savedLock;
    }
  }

  for (const field of DEAD_APP_FIELDS) {
    delete app[field];
  }

  // Layout copies have to be cleaned here: `mergeWithDefaults` only reaches the
  // top-level `widgets` and the app block, never `layouts[].widgets[]`.
  return {
    ...blob,
    app,
    widgets: stripWidgetFields(topWidgets),
    layouts: layouts.map((layout) => ({
      ...layout,
      widgets: stripWidgetFields(layout.widgets ?? []),
    })),
    bindings,
  };
};

export const v1LegacyConsolidation: Migration = {
  to: 1,
  describe: 'app-level bindings, flat layouts, app-level steering lock',
  migrate,
};
