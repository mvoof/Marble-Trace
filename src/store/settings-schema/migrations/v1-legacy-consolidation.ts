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
 * `app.steeringLock`; no bindings at all.
 *
 * The old keys are dropped rather than carried over. They cannot be translated
 * honestly: a key meant "while this layout is active" and would now mean
 * "always", each layout held its own copy so there is no single right answer as
 * to which one wins, and the old model allowed exactly one keyboard shortcut per
 * action where the new one takes any number of keys and device buttons. What
 * users get instead is the shipped defaults, and one pass through the new
 * bindings screen.
 *
 * NOTHING HERE MAY IMPORT LIVE TYPES, DEFAULTS OR REGISTRIES. The field lists
 * below are frozen as they were at 0.21 on purpose — a step that reads today's
 * registry rewrites history by tomorrow's rules.
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
  resolution?: { width?: number; height?: number };
  widgets?: LegacyWidget[];
}

/**
 * Stands in for a legacy monitor whose resolution the file does not actually
 * carry. Every field here is read out of a build older than this one and may
 * have been hand-edited; a throw would reach the loader as an unreadable file
 * and lock the user out of settings that are otherwise fine. A zero-sized
 * monitor keeps its widgets and is parked by `alignMonitorsToHardware` like any
 * other screen the machine no longer has.
 */
const MISSING_MONITOR_SIZE = 0;

const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : MISSING_MONITOR_SIZE;

/**
 * Per-widget fields that no longer exist, cleared from `widgets[]` and from
 * every layout.
 *
 * These five are the only `*Hotkey` fields any release ever wrote — pit service
 * came after 0.20 and its keys were app-level from the start, so no user file
 * can contain them.
 */
const DEAD_WIDGET_FIELDS = [
  'viewModeHotkey',
  'classPrevHotkey',
  'classNextHotkey',
  'scrollUpHotkey',
  'scrollDownHotkey',
  'steeringLimit',
];

const DEAD_APP_FIELDS = [
  'dragHotkey',
  'interactHotkey',
  'hideAllWidgetsHotkey',
  // Flag of the one-shot binding migration this chain replaces. It only ever
  // existed in unreleased builds, and is removed for their sake.
  'bindingsMigrated',
];

const STEERING_LOCK_WIDGET = 'input-trace';

const asObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

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

  const monitorConfigs = asObject(layout.monitorConfigs) as
    | Record<string, LegacyMonitorConfig>
    | undefined;

  if (monitorConfigs) {
    const monitors: Array<{
      name: string;
      bounds: { x: number; y: number; width: number; height: number };
    }> = [];
    const widgets: LegacyWidget[] = [];
    const backgroundImages: Record<string, string> = {};
    let offsetX = 0;

    for (const [name, config] of Object.entries(monitorConfigs)) {
      const width = asNumber(config?.resolution?.width);

      monitors.push({
        name,
        bounds: {
          x: offsetX,
          y: 0,
          width,
          height: asNumber(config?.resolution?.height),
        },
      });

      for (const widget of asArray<LegacyWidget>(config?.widgets)) {
        widgets.push({
          ...widget,
          userSettings: {
            ...widget.userSettings,
            x:
              ((widget.userSettings?.['x'] as number | undefined) ?? 0) +
              offsetX,
          },
        });
      }

      if (legacyBackground) {
        backgroundImages[name] = legacyBackground;
      }

      offsetX += width;
    }

    return { ...base, monitors, widgets, backgroundImages };
  }

  const targetResolution = asObject(layout.targetResolution);
  const { targetMonitorName } = layout;

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
                width: asNumber(targetResolution['width']),
                height: asNumber(targetResolution['height']),
              },
            },
          ]
        : [],
    widgets: asArray<LegacyWidget>(layout.widgets),
    backgroundImages:
      legacyBackground && targetMonitorName
        ? { [targetMonitorName]: legacyBackground }
        : {},
  };
};

const stripWidgetFields = (widgets: LegacyWidget[]): LegacyWidget[] =>
  widgets.map((entry) => {
    const widget = (asObject(entry) ?? {}) as LegacyWidget;
    const userSettings = { ...asObject(widget.userSettings) };

    for (const field of DEAD_WIDGET_FIELDS) {
      delete userSettings[field];
    }

    return { ...widget, userSettings };
  });

const migrate = (blob: SettingsBlob): SettingsBlob => {
  // An entry that is not an object cannot be repaired into a layout, and a
  // placeholder in its place would show up in the UI as a nameless one.
  const layouts = asArray<unknown>(blob['layouts'])
    .filter((layout): layout is LegacyLayout => asObject(layout) !== undefined)
    .map(normalizeLayout);

  const app = { ...(asObject(blob['app']) ?? {}) };
  const topWidgets = asArray<LegacyWidget>(blob['widgets']);

  if (app['steeringLock'] === undefined) {
    const savedLock = topWidgets.find(
      (widget) => widget?.id === STEERING_LOCK_WIDGET
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
      widgets: stripWidgetFields(asArray<LegacyWidget>(layout.widgets)),
    })),
  };
};

export const v1LegacyConsolidation: Migration = {
  to: 1,
  describe: 'flat layouts, app-level steering lock, hotkeys dropped',
  migrate,
};
