import type { Migration, SettingsBlob } from '../types';
import { asArray, asObject, dropWidgetSettings, mapEveryWidget } from '../blob';

/**
 * v2 → v3. Every widget this release changes the *shape* of.
 *
 * Four edits, one step: the version has not shipped yet, and a file migrated
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
 * again as large meant that and keeps it.
 *
 * The docked rail itself is gone in the same step — the bar is always a block in
 * the stack — so `pitApproachPlacement` and `pitApproachSide` are read for the
 * old width and then dropped.
 *
 * **4. Close Battle's width follows its columns.** Its plate spans the widget,
 * and every optional column on it — the class slab, the make, the metres, the
 * lap count — used to leave its width behind for the name to swallow, so a
 * driver who switched everything off got the same 440 px plate with a hole in
 * it. The width is now derived from the visible columns, which the widget
 * recomputes whenever one is toggled — but only on the toggle, so a file whose
 * columns were switched off before this release would keep the stale 440
 * forever. Here it is rebased once, at the scale the driver had set.
 *
 * **5. The g-meter becomes a round dial.** Its friction circle now fills the
 * plate and the numbers moved onto the rings, so the 240×280 box — a circle
 * with a two-column footer under it — describes a widget that no longer exists,
 * and its extra height would clip the disc to an ellipse. It is squared on the
 * width the driver had set: unlike the radar the circle itself is unchanged, so
 * a dial made half again as large stays that size.
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

const G_METER_ID = 'g-meter';
const G_METER_OLD_WIDTH_PX = 240;
const G_METER_SIDE_PX = 240;

const CLOSE_BATTLE_ID = 'close-battle';
const CLOSE_BATTLE_OLD_WIDTH_PX = 440;

/**
 * The plate's columns in px at design scale, frozen at the shape they had when
 * this step was written. They sum to the old 440 on the shipped defaults, which
 * is what makes the rebase a no-op for everyone who never touched a toggle.
 */
const CLOSE_BATTLE_COLUMNS_PX = {
  fixed: 40 + 20 + 7 * 8 + 12,
  classSlab: 8 * 8 + 10,
  noClassPad: 10,
  brand: 6 * 8 + 8,
  distance: 5 * 8 + 8,
  laps: 3.5 * 8,
};

/** The name column, per name mode. A file with no mode was shipped 'initial'. */
const CLOSE_BATTLE_NAME_PX: Record<string, number> = {
  surname: 78,
  initial: 96,
  full: 128,
};

/** A toggle absent from an old file was on — that is what every default was. */
const isOn = (value: unknown): boolean => value !== false;

const closeBattleWidth = (settings: SettingsBlob): number => {
  const name =
    CLOSE_BATTLE_NAME_PX[String(settings.nameMode)] ??
    CLOSE_BATTLE_NAME_PX.initial;

  const columns =
    CLOSE_BATTLE_COLUMNS_PX.fixed +
    name +
    (isOn(settings.showClassBadge)
      ? CLOSE_BATTLE_COLUMNS_PX.classSlab
      : CLOSE_BATTLE_COLUMNS_PX.noClassPad) +
    (settings.showBrand === true ? CLOSE_BATTLE_COLUMNS_PX.brand : 0) +
    (isOn(settings.showDistance) ? CLOSE_BATTLE_COLUMNS_PX.distance : 0) +
    (isOn(settings.showLapGap) ? CLOSE_BATTLE_COLUMNS_PX.laps : 0);

  return Math.round(columns);
};

/**
 * Width only: the axis the plates stand on owns the height, and it does not
 * change with a column.
 */
const rebaseCloseBattle = (
  widget: SettingsBlob,
  settings: SettingsBlob
): SettingsBlob => {
  const oldWidth = asNumber(widget.designWidth) ?? CLOSE_BATTLE_OLD_WIDTH_PX;
  const scale = (asNumber(settings.currentWidth) ?? oldWidth) / oldWidth;
  const newWidth = closeBattleWidth(settings);

  return {
    ...widget,
    designWidth: newWidth,
    userSettings: {
      ...settings,
      currentWidth: Math.round(newWidth * scale),
    },
  };
};

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

  // The placement is gone with the docked rail: the approach bar is always a
  // block in the stack now, so both keys are dropped rather than left behind to
  // be merged back in by a default that no longer exists.
  const {
    pitApproachPlacement: _placement,
    pitApproachSide: _side,
    ...kept
  } = settings;

  return {
    ...widget,
    designWidth: PIT_NEW_WIDTH_PX,
    designHeight: PIT_NEW_HEIGHT_PX,
    userSettings: {
      ...kept,
      currentWidth: Math.round(PIT_NEW_WIDTH_PX * scale),
      currentHeight: Math.round(PIT_NEW_HEIGHT_PX * scale),
    },
  };
};

/**
 * The dial, at the width the driver had it. The width is the honest half of the
 * old box — the height was the footer that is gone — so it becomes the side.
 */
const squareGMeter = (
  widget: SettingsBlob,
  settings: SettingsBlob
): SettingsBlob => {
  const oldWidth = asNumber(widget.designWidth) ?? G_METER_OLD_WIDTH_PX;
  const scale = (asNumber(settings.currentWidth) ?? oldWidth) / oldWidth;
  const side = Math.round(G_METER_SIDE_PX * scale);

  return {
    ...widget,
    designWidth: G_METER_SIDE_PX,
    designHeight: G_METER_SIDE_PX,
    userSettings: {
      ...settings,
      borderColor: 'transparent',
      currentWidth: side,
      currentHeight: side,
    },
  };
};

/** The command that receives it refuses anything outside this range. */
const MIN_CAR_LENGTH_M = 0.5;
const MAX_CAR_LENGTH_M = 15;

/**
 * Every widget the file holds, in the order the value should be trusted: the
 * layouts first, because that is where a driver's radar actually lives, and the
 * dying top-level list only as a fallback for a file that predates layouts.
 *
 * Reading the top-level list alone would have found nothing in any real file —
 * one car length per process, and the layouts are what carry it.
 */
const everyWidget = (blob: SettingsBlob): Record<string, unknown>[] => {
  const fromLayouts = asArray<unknown>(blob['layouts']).flatMap((layout) =>
    asArray<unknown>(asObject(layout)?.['widgets'])
  );

  return [...fromLayouts, ...asArray<unknown>(blob['widgets'])]
    .map((candidate) => asObject(candidate))
    .filter(
      (candidate): candidate is Record<string, unknown> =>
        candidate !== undefined
    );
};

const validCarLength = (widget: Record<string, unknown>) => {
  const value = asObject(widget['userSettings'])?.['carLength'];

  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_CAR_LENGTH_M &&
    value <= MAX_CAR_LENGTH_M
  ) {
    return value;
  }

  return undefined;
};

/**
 * The car length the app settings inherit, preferring the proximity radar over
 * the bar as the old startup code did.
 *
 * Every copy of a radar is examined, not just the first one found: each layout
 * carries its own, and the driver may well have set the length on one of them
 * and left the rest untouched. Stopping at the first copy would read a layout
 * that happens to be missing the value and conclude nobody ever chose one.
 */
const readCarLength = (blob: SettingsBlob): number | undefined => {
  const widgets = everyWidget(blob);

  for (const id of RADAR_IDS) {
    const found = widgets
      .filter((candidate) => candidate['id'] === id)
      .map(validCarLength)
      .find((value) => value !== undefined);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
};

/**
 * **4. The top-level `widgets[]` is dropped.**
 *
 * It is the last trace of the single-layout app: since layouts arrived, the
 * active layout owns the widgets, and this copy was written on every save and
 * then discarded on the next load. Keeping it only invited the two to disagree.
 *
 * A file whose `layouts` is empty is the one case where it still carries
 * something — it predates layouts entirely, so this array *is* that driver's
 * setup. It is moved into `defaultWidgets`, the template catalogue a first
 * layout is built from, so their widgets come back in the layout the app
 * creates for them instead of being replaced by the shipped defaults. A file
 * that already has a catalogue keeps it: that one was chosen deliberately.
 */
const dropTopLevelWidgets = (blob: SettingsBlob): SettingsBlob => {
  if (!('widgets' in blob)) {
    return blob;
  }

  const rest = { ...blob };

  delete rest['widgets'];

  const topWidgets = asArray<unknown>(blob['widgets']);
  const hasLayouts = asArray<unknown>(blob['layouts']).length > 0;
  const hasCatalogue = asArray<unknown>(blob['defaultWidgets']).length > 0;

  if (hasLayouts || hasCatalogue || topWidgets.length === 0) {
    return rest;
  }

  return { ...rest, defaultWidgets: topWidgets };
};

export const v3WidgetShapes: Migration = {
  to: 3,
  describe:
    'move the car length to app settings, square up the radar and the g-meter, rescale the pit box, rebase Close Battle on its columns, drop the top-level widget list',
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

    const reshaped = mapEveryWidget(withoutCarLength, (widgets) =>
      widgets.map((widget) => {
        if (widget?.id === CLOSE_BATTLE_ID) {
          return rebaseCloseBattle(widget, asObject(widget.userSettings) ?? {});
        }

        if (widget?.id === G_METER_ID) {
          return squareGMeter(widget, asObject(widget.userSettings) ?? {});
        }

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

    return dropTopLevelWidgets(reshaped);
  },
};
