import type { Migration, SettingsBlob } from '../types';
import { asArray, asObject, dropWidgetSettings } from '../blob';

/**
 * v2 → v3. Lifts `carLength` out of the two radar widgets and into `app`.
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
 * Every literal here is frozen on purpose: this step has to keep meaning "move
 * carLength to app" however the widgets are named or defaulted later.
 */
const RADAR_IDS = ['proximity-radar', 'radar-bar'] as const;

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

export const v3CarLengthToApp: Migration = {
  to: 3,
  describe: 'move the car length from the radars to app settings',
  migrate: (blob: SettingsBlob): SettingsBlob => {
    const carLength = readCarLength(blob);

    const withApp =
      carLength === undefined
        ? blob
        : {
            ...blob,
            app: { ...(asObject(blob.app) ?? {}), carLength },
          };

    return RADAR_IDS.reduce(
      (current, id) => dropWidgetSettings(current, id, ['carLength']),
      withApp
    );
  },
};
