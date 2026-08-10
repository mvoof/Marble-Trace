import type { Migration, SettingsBlob } from '../types';

/**
 * v1 → v2. The Race Dash coach tab became its own widget.
 *
 * Before: `race-dash` carried `showReferenceSpeed`, `brakeColor` and
 * `gasColor`, and the plate was 430 design px wide to make room for the coach
 * tab on its right.
 *
 * After: those three keys are gone from `race-dash`, and the plate is 334 px —
 * the width it has without the tab. A user who had the coach tab switched on
 * gets the new `coach` widget seeded with their two accent colors, placed under
 * the dash; a user who had it off is left alone, and picks the widget up from
 * the catalog if they want it.
 *
 * NOTHING HERE MAY IMPORT LIVE TYPES, DEFAULTS OR REGISTRIES. Every literal
 * below is frozen as it stood at this schema version on purpose.
 */

interface LegacyWidget {
  id?: string;
  userSettings?: Record<string, unknown>;
}

const RACE_DASH_ID = 'race-dash';
const COACH_ID = 'coach';

const DEAD_RACE_DASH_FIELDS = ['showReferenceSpeed', 'brakeColor', 'gasColor'];

/** Race Dash's width before and after the coach tab was removed from the plate. */
const RACE_DASH_WIDTH_WITH_COACH = 430;
const RACE_DASH_WIDTH_WITHOUT_COACH = 334;
const RACE_DASH_DESIGN_HEIGHT = 104;

/** The new widget's own defaults, frozen as they shipped with this migration. */
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

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

/**
 * Narrows the stored plate by the width the coach tab used to occupy, keeping
 * the user's own scaling: the widget locks its aspect ratio to the ring, so the
 * height has to be treated as the source of truth and the width rebuilt from it.
 */
const shrinkRaceDash = (
  userSettings: Record<string, unknown>
): Record<string, unknown> => {
  const storedWidth = asNumber(
    userSettings['currentWidth'],
    RACE_DASH_WIDTH_WITH_COACH
  );
  const storedHeight = asNumber(
    userSettings['currentHeight'],
    RACE_DASH_DESIGN_HEIGHT
  );

  const scale =
    storedHeight > 0
      ? storedHeight / RACE_DASH_DESIGN_HEIGHT
      : storedWidth / RACE_DASH_WIDTH_WITH_COACH;

  return {
    ...userSettings,
    currentWidth: Math.round(RACE_DASH_WIDTH_WITHOUT_COACH * scale),
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
    x: asNumber(raceDash['x'], COACH_DEFAULTS.x),
    y:
      asNumber(raceDash['y'], COACH_DEFAULTS.y) +
      asNumber(raceDash['currentHeight'], RACE_DASH_DESIGN_HEIGHT),
    brakeColor: asString(raceDash['brakeColor'], COACH_DEFAULTS.brakeColor),
    gasColor: asString(raceDash['gasColor'], COACH_DEFAULTS.gasColor),
    lossColor: asString(raceDash['brakeColor'], COACH_DEFAULTS.lossColor),
    gainColor: asString(raceDash['gasColor'], COACH_DEFAULTS.gainColor),
  },
});

/** Rewrites one `widgets[]` array: strips the dash, and adds the coach when it is owed one. */
const convertWidgets = (widgets: LegacyWidget[]): LegacyWidget[] => {
  const entries = widgets
    .filter((entry): entry is LegacyWidget => asObject(entry) !== undefined)
    .map((entry) => ({ ...entry }));

  const raceDash = entries.find((widget) => widget?.id === RACE_DASH_ID);
  const raceDashSettings = asObject(raceDash?.userSettings) ?? {};

  const owedCoach =
    raceDash !== undefined &&
    raceDashSettings['showReferenceSpeed'] === true &&
    raceDashSettings['enabled'] === true &&
    !entries.some((widget) => widget?.id === COACH_ID);

  const converted = entries.map((widget) =>
    widget?.id === RACE_DASH_ID ? stripRaceDash(widget) : widget
  );

  return owedCoach
    ? [...converted, coachFromRaceDash(raceDashSettings)]
    : converted;
};

const migrate = (blob: SettingsBlob): SettingsBlob => {
  const layouts = asArray<unknown>(blob['layouts'])
    .filter(
      (layout): layout is Record<string, unknown> =>
        asObject(layout) !== undefined
    )
    .map((layout) => ({
      ...layout,
      widgets: convertWidgets(asArray<LegacyWidget>(layout['widgets'])),
    }));

  // Layout copies have to be converted here too: `mergeWithDefaults` only
  // reaches the top-level `widgets`, never `layouts[].widgets[]`.
  return {
    ...blob,
    widgets: convertWidgets(asArray<LegacyWidget>(blob['widgets'])),
    layouts,
  };
};

export const v2CoachWidgetSplit: Migration = {
  to: 2,
  describe: 'coach tab split out of race dash into its own widget',
  migrate,
};
