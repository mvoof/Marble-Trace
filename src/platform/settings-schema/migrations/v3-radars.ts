import type { Migration, SettingsBlob } from '../types';
import { asArray, asObject, dropWidgetSettings, mapEveryWidget } from '../blob';

/**
 * v2 → v3. Everything this release changes about the two radars.
 *
 * Two edits, one step: the version has not shipped yet, and a file migrated
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
 * Every literal here is frozen on purpose: this step has to keep meaning "move
 * carLength, square up the radar" however the widgets are named or defaulted
 * later.
 */
const RADAR_IDS = ['proximity-radar', 'radar-bar'] as const;

const PROXIMITY_RADAR_ID = 'proximity-radar';
const SCOPE_SIDE_PX = 180;

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

export const v3Radars: Migration = {
  to: 3,
  describe: 'move the car length to app settings, square up the radar',
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
