import type { Migration, SettingsBlob } from '../types';
import { asArray, asObject, dropWidgetSettings, mapEveryWidget } from '../blob';

/**
 * v2 → v3. Every widget this release changes the *shape* of.
 *
 * Three edits, one step: the version has not shipped yet, and a file migrated
 * through a version no build ever wrote is history nobody has.
 *
 * **1. `carLength` out of the widgets and into `app`.**
 *
 * It was never a widget setting in the first place: the backend keeps one car
 * length per process, and the store used to copy the value from one radar to
 * the other by hand to keep them from disagreeing. Close Battle became the
 * third reader — the point at which a hand-written sync stops being a shortcut
 * and starts being a bug waiting for the next widget.
 *
 * The value is read from `proximity-radar` first and from `radar-bar` only as a
 * fallback, which is the same precedence the old startup code used. A file
 * where neither carries it (or carries something absurd) is left to the app
 * default rather than migrated to a number nobody chose.
 *
 * **2. The proximity radar becomes a round scope.** It used to be a 200×300
 * portrait plate; the disc is square, and a saved rectangle would be clipped to
 * an ellipse. The stored size is reset to the new design size rather than
 * scaled, because the old height described a shape that no longer exists. The
 * saved *design* size is squared with it: it is stored per widget and wins over
 * the manifest on load, so a portrait one left behind would keep skewing the
 * scale factor long after the plate became a disc.
 *
 * **3. Pit Service is rebuilt half the height and 40 px narrower.** The blocks
 * it draws changed shape — the speed plate became one row, the tire corners
 * lost their headings — so the design size that describes it changed with them:
 * 300×540 to 235×330. The docked approach rail no longer widens the panel — it
 * is carved out of it — so a file that was 360 wide for the rail lands on the
 * same 235 as everyone else.
 *
 * The stored size is *rescaled* rather than reset: unlike the radar, the widget
 * is the same shape as before, only tighter, so a driver who had made it half
 * again as large meant that and keeps it. Left alone, the re-base would ambush
 * them instead — the resolver that follows the rail placement recomputes the
 * width from the manifest's base, so the first time they moved the rail the
 * widget would jump to a size they never asked for.
 *
 * Every literal here is frozen on purpose: this step has to keep meaning "move
 * carLength, square up the radar, rescale the pit box" however the widgets are
 * named or defaulted later.
 */
const RADAR_IDS = ['proximity-radar', 'radar-bar'] as const;

const PROXIMITY_RADAR_ID = 'proximity-radar';
const SCOPE_SIDE_PX = 180;

const PIT_SERVICE_ID = 'pit-service';
const PIT_OLD_WIDTH_PX = 300;
const PIT_OLD_SIDE_RAIL_WIDTH_PX = 360;
const PIT_NEW_WIDTH_PX = 235;
const PIT_NEW_HEIGHT_PX = 330;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;

/**
 * The pit box, at the size the driver had it. `settings` is the widget's saved
 * `userSettings`; a file whose rail was docked was measured against the wider of
 * the two old bases, and one that never stored a size keeps the default of the
 * day. There is only one new width: the rail is drawn inside it now.
 */
const rescalePitService = (
  widget: SettingsBlob,
  settings: SettingsBlob
): SettingsBlob => {
  const hadSideRail =
    settings.showPitApproach !== false &&
    settings.pitApproachPlacement === 'side';

  const oldWidth =
    asNumber(widget.designWidth) ??
    (hadSideRail ? PIT_OLD_SIDE_RAIL_WIDTH_PX : PIT_OLD_WIDTH_PX);

  const scale = (asNumber(settings.currentWidth) ?? oldWidth) / oldWidth;

  return {
    ...widget,
    designWidth: PIT_NEW_WIDTH_PX,
    designHeight: PIT_NEW_HEIGHT_PX,
    userSettings: {
      ...settings,
      currentWidth: Math.round(PIT_NEW_WIDTH_PX * scale),
      currentHeight: Math.round(PIT_NEW_HEIGHT_PX * scale),
    },
  };
};

/** The command that receives it refuses anything outside this range. */
const MIN_CAR_LENGTH_M = 0.5;
const MAX_CAR_LENGTH_M = 15;

const readCarLength = (blob: SettingsBlob): number | undefined => {
  const widgets = asArray<unknown>(blob.widgets);

  for (const id of RADAR_IDS) {
    const widget = widgets
      .map((candidate) => asObject(candidate))
      .find((candidate) => candidate?.id === id);

    const settings = asObject(widget?.userSettings);
    const value = settings?.carLength;

    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= MIN_CAR_LENGTH_M &&
      value <= MAX_CAR_LENGTH_M
    ) {
      return value;
    }
  }

  return undefined;
};

export const v3WidgetShapes: Migration = {
  to: 3,
  describe:
    'move the car length to app settings, square up the radar, rescale the pit box',
  migrate: (blob: SettingsBlob): SettingsBlob => {
    const carLength = readCarLength(blob);

    const withApp =
      carLength === undefined
        ? blob
        : {
            ...blob,
            app: { ...(asObject(blob.app) ?? {}), carLength },
          };

    const withoutCarLength = RADAR_IDS.reduce(
      (current, id) => dropWidgetSettings(current, id, ['carLength']),
      withApp
    );

    return mapEveryWidget(withoutCarLength, (widgets) =>
      widgets.map((widget) => {
        if (widget?.id === PIT_SERVICE_ID) {
          return rescalePitService(widget, asObject(widget.userSettings) ?? {});
        }

        if (widget?.id !== PROXIMITY_RADAR_ID) {
          return widget;
        }

        return {
          ...widget,
          designWidth: SCOPE_SIDE_PX,
          designHeight: SCOPE_SIDE_PX,
          userSettings: {
            ...(asObject(widget.userSettings) ?? {}),
            currentWidth: SCOPE_SIDE_PX,
            currentHeight: SCOPE_SIDE_PX,
          },
        };
      })
    );
  },
};
