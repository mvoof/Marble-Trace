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
 * It also splits the Race Dash coach tab out into the standalone `coach` widget.
 * That change landed after 0.20 too, so no released build ever wrote a file with
 * the tab gone — it belongs in this same v0 → v1 step rather than a v2 of its
 * own, which would only ever run on unreleased local configs.
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

const RACE_DASH_ID = 'race-dash';
const COACH_ID = 'coach';

const PIT_SERVICE_ID = 'pit-service';

/**
 * Pit service settings that arrived with the fuel keys. Without them the keys
 * move the order by `NaN` liters, the settings panel renders with nothing
 * selected, and the reveal timer never fires — and `mergeWithDefaults` cannot
 * fill them in, because it never reaches `layouts[].widgets[]`, which is where
 * the copy the driver actually uses is stored.
 *
 * They ride along in this step rather than a v2 of their own for the same
 * reason the coach split does: no released build has ever written a v1 file, so
 * a separate step would only ever run on unreleased local configs.
 */
const PIT_SERVICE_FUEL_ADJUST_STEP = 1;
const PIT_SERVICE_COMMAND_REVEAL_SECONDS = 5;

/**
 * Race Dash keys that only existed to drive the coach tab, dropped along with
 * the tab itself, plus the side the pit box cue used to sit on — nothing has
 * read it since the pit block stopped mirroring its layout.
 */
const DEAD_RACE_DASH_FIELDS = [
  'showReferenceSpeed',
  'brakeColor',
  'gasColor',
  'pitBoxSide',
];

/**
 * Race Dash's width as 0.20 wrote it, and as this build draws it: the coach tab
 * came off the plate, then the plate was rebuilt as a symmetric pill whose right
 * cap needs room the square end did not. Both changes landed after 0.20, so the
 * step targets the final width directly rather than stopping at an intermediate
 * one no released build ever wrote.
 */
const RACE_DASH_WIDTH_WITH_COACH = 430;
const RACE_DASH_WIDTH_PILL = 418;
const RACE_DASH_DESIGN_HEIGHT = 104;

/** The coach widget's own defaults, frozen as they shipped with this step. */
const COACH_DEFAULTS = {
  enabled: false,
  x: 400,
  y: 240,
  currentWidth: 300,
  currentHeight: 130,
  opacity: 1,
  fontScale: 1,
  backgroundColor: 'rgba(21, 22, 26, 0.8)',
  borderColor: 'rgba(255, 255, 255, 0.1)',
  showTrace: true,
  traceChannel: 'speed',
  windowMeters: 150,
  showUrgencyBar: true,
  showSpeed: true,
  showReferenceLapTime: true,
  showTrackCondition: true,
  brakeColor: '#ef4444',
  gasColor: '#10b981',
  referenceColor: '#a855f7',
  gainColor: '#10b981',
  lossColor: '#ef4444',
};

const asObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

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

/**
 * Narrows the stored plate by the width the coach tab used to occupy, keeping
 * the user's own scaling: the widget locks its aspect ratio to the ring, so the
 * height has to be treated as the source of truth and the width rebuilt from it.
 */
const shrinkRaceDash = (
  userSettings: Record<string, unknown>
): Record<string, unknown> => {
  const storedWidth = numberOr(
    userSettings['currentWidth'],
    RACE_DASH_WIDTH_WITH_COACH
  );
  const storedHeight = numberOr(
    userSettings['currentHeight'],
    RACE_DASH_DESIGN_HEIGHT
  );

  const scale =
    storedHeight > 0
      ? storedHeight / RACE_DASH_DESIGN_HEIGHT
      : storedWidth / RACE_DASH_WIDTH_WITH_COACH;

  return {
    ...userSettings,
    currentWidth: Math.round(RACE_DASH_WIDTH_PILL * scale),
  };
};

const stripRaceDash = (widget: LegacyWidget): LegacyWidget => {
  const userSettings = { ...asObject(widget.userSettings) };

  for (const field of DEAD_RACE_DASH_FIELDS) {
    delete userSettings[field];
  }

  return { ...widget, userSettings: shrinkRaceDash(userSettings) };
};

/**
 * The coach carried over from a Race Dash that had the tab on: same accent
 * colors, enabled, and parked just under the dash so it is where the user was
 * already looking.
 */
const coachFromRaceDash = (
  raceDash: Record<string, unknown>
): LegacyWidget => ({
  id: COACH_ID,
  userSettings: {
    ...COACH_DEFAULTS,
    enabled: true,
    x: numberOr(raceDash['x'], COACH_DEFAULTS.x),
    y:
      numberOr(raceDash['y'], COACH_DEFAULTS.y) +
      numberOr(raceDash['currentHeight'], RACE_DASH_DESIGN_HEIGHT),
    brakeColor: stringOr(raceDash['brakeColor'], COACH_DEFAULTS.brakeColor),
    gasColor: stringOr(raceDash['gasColor'], COACH_DEFAULTS.gasColor),
    lossColor: stringOr(raceDash['brakeColor'], COACH_DEFAULTS.lossColor),
    gainColor: stringOr(raceDash['gasColor'], COACH_DEFAULTS.gainColor),
  },
});

/**
 * Strips the dash of its coach keys, and adds the coach widget when the user had
 * the tab switched on. A user who had it off is left alone, and picks the widget
 * up from the catalog if they want it.
 */
const splitCoachOut = (widgets: LegacyWidget[]): LegacyWidget[] => {
  const raceDash = widgets.find((widget) => widget?.id === RACE_DASH_ID);
  const raceDashSettings = asObject(raceDash?.userSettings) ?? {};

  const owedCoach =
    raceDash !== undefined &&
    raceDashSettings['showReferenceSpeed'] === true &&
    raceDashSettings['enabled'] === true &&
    !widgets.some((widget) => widget?.id === COACH_ID);

  // A dash with no `showReferenceSpeed` never had the tab, so it was never the
  // wider plate either — narrowing it again would shrink it on every run.
  const converted = widgets.map((widget) =>
    widget?.id === RACE_DASH_ID &&
    asObject(widget.userSettings)?.['showReferenceSpeed'] !== undefined
      ? stripRaceDash(widget)
      : widget
  );

  return owedCoach
    ? [...converted, coachFromRaceDash(raceDashSettings)]
    : converted;
};

/**
 * Only fills the gap: a file already carrying a step was written by a build
 * that had the setting, and the driver's pick is not this step's to overwrite.
 */
const PIT_SERVICE_ADDED_SETTINGS: Record<string, unknown> = {
  fuelAdjustStep: PIT_SERVICE_FUEL_ADJUST_STEP,
  commandRevealSeconds: PIT_SERVICE_COMMAND_REVEAL_SECONDS,
};

const addPitServiceSettings = (widgets: LegacyWidget[]): LegacyWidget[] =>
  widgets.map((widget) => {
    if (widget?.id !== PIT_SERVICE_ID) {
      return widget;
    }

    const userSettings = { ...asObject(widget.userSettings) };

    // Each key is filled on its own: a file carrying one of them but not the
    // other was written mid-development, and a single guard over both would
    // either skip the missing one or overwrite the value the driver picked.
    for (const [key, value] of Object.entries(PIT_SERVICE_ADDED_SETTINGS)) {
      if (userSettings[key] === undefined) {
        userSettings[key] = value;
      }
    }

    return { ...widget, userSettings };
  });

/** Every pass over one `widgets[]` array, in the order the file needs them. */
const convertWidgets = (widgets: LegacyWidget[]): LegacyWidget[] =>
  addPitServiceSettings(splitCoachOut(stripWidgetFields(widgets)));

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
    widgets: convertWidgets(topWidgets),
    layouts: layouts.map((layout) => ({
      ...layout,
      widgets: convertWidgets(asArray<LegacyWidget>(layout.widgets)),
    })),
  };
};

export const v1LegacyConsolidation: Migration = {
  to: 1,
  describe:
    'flat layouts, app-level steering lock, hotkeys dropped, coach split out of race dash, pit service fuel keys',
  migrate,
};
