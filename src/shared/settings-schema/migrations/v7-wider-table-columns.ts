import type { Migration, SettingsBlob } from '../types';
import {
  asArray,
  asObject,
  dropStoredWidgetSettings,
  mapEveryStoredWidget,
  patchStoredWidgetSettings,
  type StoredBlobWidget,
} from '../blob';

/**
 * v6 → v7. The Standings and Relative columns grew wider.
 *
 * Every value cell gained a little padding on both sides, Standings gained
 * two columns shown by default — the interval and the lap delta — and the
 * safety rating and iRating became chips, each in a column of its chip's own
 * width. A table's design width is the sum of its columns, so it moved with
 * them.
 *
 * The file does not hold that design width unless it departs from the one the
 * settings derive, and on load the derived width is taken as it is: the frame
 * stays the width on disk while the columns inside it need more, and `--wfs`
 * (`currentWidth / designWidth`) shrinks every table's text. This step keeps
 * the text where it was by widening the frame by the same ratio the columns
 * grew. A widget with a design width of its own on disk needs nothing: the load
 * path already rescales its frame against the derived width.
 *
 * Both column layouts — v6's and this one's — are frozen below with the
 * defaults of the builds that wrote them. An absent setting is on the shipped
 * default, and the default that matters is the one of the build that wrote the
 * file, not of whichever build runs this step later.
 *
 * Fuel moved the same way: its design width became the redesign mockup's card,
 * 306 instead of 240, and its frame widens by that ratio so the text keeps its
 * size — a default 240 frame comes out at 306. The lap log moved with it: its
 * design width became its mockup card, 264 instead of 220, and its height
 * stopped following its laps — a taller frame now shows more of them — so the
 * height it had on disk, never its own, gives way to its design height of 385
 * at the frame's scale. The sector matrix moved too: its design width became
 * its mockup card, 330 instead of 320, and its frame widens by that ratio.
 *
 * The sector matrix's predicted lap also stopped being a switch: `showPredicted`
 * became `predictedLap`, shown always, once it has a time, or never. On is
 * `always`, off is `never`; a value that is no boolean is dropped, so the
 * default takes it.
 *
 * The fuel strategy (pit warning laps, the averaging window, laps under a
 * local yellow) leaves the Fuel widget for `app`: the backend computes fuel
 * once for the car, so only one copy of it ever counted. The values are taken
 * from the copy that counted until now — see `liftFuelStrategy` — and dropped
 * from every copy and the template. An absent key stays absent: it is on the
 * shipped default.
 */

type TableSettings = Record<string, unknown>;

// The widgets whose design width moved, in v6 and in v7, frozen.
interface DesignWidthRebase {
  before: number;
  after: number;
  /**
   * The design height of a widget whose height used to follow its content and
   * now is the frame's: the stored height meant nothing, so the frame takes
   * this one at its new scale.
   */
  fitHeight?: number;
}

const DESIGN_WIDTH_REBASES: Readonly<Record<string, DesignWidthRebase>> = {
  fuel: { before: 240, after: 306 },
  'lap-log': { before: 220, after: 264, fitHeight: 385 },
  'sector-matrix': { before: 320, after: 330 },
};

type WidthOf = (settings: TableSettings) => number;

const COL_GAP_PX = 2;
const ROW_PAD_X_PX = 10;
const CELL_PAD_X_PX = 4;

const padded = (contentPx: number): number => contentPx + CELL_PAD_X_PX * 2;

const LIC_COLUMN_PX: Record<
  string,
  { withLetter: number; ratingOnly: number }
> = {
  badge: { withLetter: 60, ratingOnly: 42 },
  dark: { withLetter: 60, ratingOnly: 42 },
  plain: { withLetter: 48, ratingOnly: 34 },
};

// The rating chips of v7, frozen: JetBrains Mono digits at 11px, a filled SR
// chip with no edge and its padding taking the edges back, a row chip's side
// padding and edges.
const RATING_ADVANCE_PX = 0.6 * 11;
const RATING_SOLID_PAD_PX = 10;
const RATING_TINT_PAD_PX = 8;
const RATING_VALUE_PAD_PX = 8;
const RATING_EDGE_PX = 2;

interface Column {
  show: (settings: TableSettings) => boolean;
  /** Width in v6, or null for a column v6 did not have. */
  before: WidthOf | null;
  /** Width in v7, or null for a column v7 no longer has. */
  after: WidthOf | null;
}

const flag =
  (key: string, fallback: boolean) =>
  (settings: TableSettings): boolean => {
    const value = settings[key];

    return typeof value === 'boolean' ? value : fallback;
  };

const always = (): boolean => true;

const fixed =
  (px: number): WidthOf =>
  () =>
    px;

const nameWidth =
  (min: number, max: number, fallback: number): WidthOf =>
  (settings) => {
    const value = settings['nameColumnWidth'];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.round(value)));
  };

const licWidth: WidthOf = (settings) => {
  const style = settings['licBadgeStyle'];
  const widths =
    (typeof style === 'string' ? LIC_COLUMN_PX[style] : undefined) ??
    LIC_COLUMN_PX['badge'];

  return flag('showLicenseLetter', true)(settings)
    ? widths.withLetter
    : widths.ratingOnly;
};

const iRatingWidth =
  (abbreviatedPx: number, fullPx: number): WidthOf =>
  (settings) =>
    flag('abbreviateIRating', true)(settings) ? abbreviatedPx : fullPx;

/** The v7 SR column: its chip, padded. */
const srColumnWidth: WidthOf = (settings) => {
  const chars = flag('showLicenseLetter', true)(settings) ? 6 : 4;
  const chipPx =
    settings['licBadgeStyle'] === 'dark'
      ? RATING_TINT_PAD_PX + RATING_EDGE_PX + chars * RATING_ADVANCE_PX
      : RATING_SOLID_PAD_PX + chars * RATING_ADVANCE_PX;

  return Math.ceil(chipPx + CELL_PAD_X_PX * 2);
};

/** The v7 iRating column: its chip, padded. */
const irColumnWidth: WidthOf = (settings) => {
  const chars = flag('abbreviateIRating', true)(settings) ? 4 : 5;

  return Math.ceil(
    RATING_VALUE_PAD_PX +
      RATING_EDGE_PX +
      chars * RATING_ADVANCE_PX +
      CELL_PAD_X_PX * 2
  );
};

const STANDINGS_COLUMNS: readonly Column[] = [
  { show: always, before: fixed(28), after: fixed(28) },
  { show: always, before: fixed(40), after: fixed(padded(40)) },
  {
    show: flag('showPosChange', true),
    before: fixed(38),
    after: fixed(padded(38)),
  },
  {
    show: flag('showCountryFlag', false),
    before: fixed(22),
    after: fixed(padded(22)),
  },
  {
    show: always,
    before: nameWidth(80, 320, 200),
    after: nameWidth(80, 320, 200),
  },
  {
    show: flag('showLicBadge', true),
    before: licWidth,
    after: srColumnWidth,
  },
  {
    show: flag('showIRating', true),
    before: iRatingWidth(42, 52),
    after: irColumnWidth,
  },
  {
    show: flag('showIrChange', true),
    before: fixed(42),
    after: fixed(padded(42)),
  },
  {
    show: flag('showLapsCompleted', true),
    before: fixed(28),
    after: fixed(padded(28)),
  },
  { show: flag('showGap', true), before: fixed(50), after: fixed(padded(50)) },
  { show: flag('showInterval', true), before: null, after: fixed(padded(50)) },
  {
    show: flag('showLastLap', true),
    before: fixed(82),
    // The lap time alone: "10:32.400" at 12px, padded.
    after: fixed(73),
  },
  { show: flag('showLapDelta', true), before: null, after: fixed(padded(50)) },
  {
    show: flag('showBestLap', true),
    before: fixed(82),
    // A chip of the lap time: its digits at 11px, padding and edges, padded.
    after: fixed(86),
  },
  {
    show: flag('showBrand', true),
    before: fixed(36),
    after: fixed(padded(36)),
  },
  { show: flag('showTire', true), before: fixed(30), after: fixed(padded(30)) },
];

const RELATIVE_COLUMNS: readonly Column[] = [
  { show: always, before: fixed(28), after: fixed(28) },
  {
    show: flag('showCarNumber', true),
    before: fixed(40),
    after: fixed(padded(40)),
  },
  {
    show: flag('showCountryFlag', false),
    before: fixed(22),
    after: fixed(padded(22)),
  },
  {
    show: always,
    before: nameWidth(80, 300, 180),
    after: nameWidth(80, 300, 180),
  },
  {
    show: flag('showLicBadge', true),
    before: licWidth,
    after: srColumnWidth,
  },
  {
    show: flag('showIRating', true),
    before: iRatingWidth(36, 48),
    after: irColumnWidth,
  },
  { show: always, before: fixed(56), after: fixed(padded(56)) },
];

const TABLE_COLUMNS: Readonly<Record<string, readonly Column[]>> = {
  standings: STANDINGS_COLUMNS,
  relative: RELATIVE_COLUMNS,
};

const designWidth = (
  columns: readonly Column[],
  settings: TableSettings,
  side: 'before' | 'after'
): number => {
  const widths = columns
    .filter((column) => column[side] !== null && column.show(settings))
    .map((column) => (column[side] as WidthOf)(settings));

  const columnsWidth = widths.reduce((sum, width) => sum + width, 0);
  const gaps = Math.max(0, widths.length - 1) * COL_GAP_PX;

  return Math.round(columnsWidth + gaps + ROW_PAD_X_PX * 2);
};

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/** The box width the table needs to keep its text the size it was, or null. */
const widenedWidth = (
  columns: readonly Column[],
  settings: TableSettings,
  width: unknown
): number | null => {
  if (!isPositive(width)) {
    return null;
  }

  const before = designWidth(columns, settings, 'before');
  const after = designWidth(columns, settings, 'after');

  return Math.round((width / before) * after);
};

/** A size scaled by its widget's design-width ratio, or null when it is not a size. */
const rebasedSize = (
  type: string,
  size: Record<string, unknown>
): Record<string, unknown> | null => {
  const { width, height } = size;
  const rebase = DESIGN_WIDTH_REBASES[type];

  if (!rebase || !isPositive(width)) {
    return null;
  }

  const ratio = rebase.after / rebase.before;
  const nextWidth = Math.round(width * ratio);

  if (rebase.fitHeight !== undefined) {
    return {
      ...size,
      width: nextWidth,
      height: Math.round((nextWidth / rebase.after) * rebase.fitHeight),
    };
  }

  return {
    ...size,
    width: nextWidth,
    ...(isPositive(height) ? { height: Math.round(height * ratio) } : {}),
  };
};

const rebaseInstance = (
  type: string,
  widget: StoredBlobWidget
): StoredBlobWidget => {
  const frame = asObject(widget?.frame);

  if (!frame || widget.design !== undefined) {
    return widget;
  }

  const widened = rebasedSize(type, frame);

  return widened === null ? widget : { ...widget, frame: widened };
};

const widenInstance = (widget: StoredBlobWidget): StoredBlobWidget => {
  if (typeof widget?.type === 'string' && widget.type in DESIGN_WIDTH_REBASES) {
    return rebaseInstance(widget.type, widget);
  }

  const columns =
    typeof widget?.type === 'string' ? TABLE_COLUMNS[widget.type] : undefined;
  const frame = asObject(widget?.frame);

  if (!columns || !frame || widget.design !== undefined) {
    return widget;
  }

  const width = widenedWidth(
    columns,
    asObject(widget.settings) ?? {},
    frame['width']
  );

  return width === null ? widget : { ...widget, frame: { ...frame, width } };
};

const widenTemplates = (blob: SettingsBlob): SettingsBlob => {
  const templates = asObject(blob['widgetTemplates']);

  if (!templates) {
    return blob;
  }

  const widened: Record<string, unknown> = { ...templates };

  for (const [type, columns] of Object.entries(TABLE_COLUMNS)) {
    const template = asObject(templates[type]);
    const size = asObject(template?.['size']);

    if (!template || !size || template['design'] !== undefined) {
      continue;
    }

    const width = widenedWidth(
      columns,
      asObject(template['settings']) ?? {},
      size['width']
    );

    if (width !== null) {
      widened[type] = { ...template, size: { ...size, width } };
    }
  }

  for (const type of Object.keys(DESIGN_WIDTH_REBASES)) {
    const template = asObject(templates[type]);
    const templateSize = asObject(template?.['size']);

    if (!template || !templateSize || template['design'] !== undefined) {
      continue;
    }

    const size = rebasedSize(type, templateSize);

    if (size !== null) {
      widened[type] = { ...template, size };
    }
  }

  return { ...blob, widgetTemplates: widened };
};

const predictedLapVisibility = (
  settings: Record<string, unknown>
): Record<string, unknown> => {
  if (!('showPredicted' in settings)) {
    return settings;
  }

  const { showPredicted, ...rest } = settings;

  if (typeof showPredicted !== 'boolean') {
    return rest;
  }

  return { ...rest, predictedLap: showPredicted ? 'always' : 'never' };
};

const FUEL_TYPE = 'fuel';

/** Widget setting → app setting, frozen. */
const FUEL_STRATEGY_KEYS: Readonly<Record<string, string>> = {
  pitWarningLaps: 'fuelPitWarningLaps',
  fuelAvgWindow: 'fuelAvgWindow',
  countYellowFlagLaps: 'fuelCountYellowFlagLaps',
};

/**
 * The Fuel copy whose settings the backend ran with: in the active layout
 * (else the first), a physical display ahead of a remote screen, a switched-on
 * copy ahead of one that is off. Falls back to the template.
 */
const fuelStrategySource = (
  blob: SettingsBlob
): Record<string, unknown> | undefined => {
  const layouts = asArray<unknown>(blob['layouts'])
    .map(asObject)
    .filter((layout): layout is Record<string, unknown> => !!layout);
  const layout =
    layouts.find((entry) => entry['id'] === blob['activeLayoutId']) ??
    layouts[0];
  const monitors = asArray<unknown>(layout?.['monitors'])
    .map(asObject)
    .filter((monitor): monitor is Record<string, unknown> => !!monitor);
  const instancesOn = (isRemote: boolean) =>
    monitors
      .filter((monitor) => (monitor['kind'] === 'remote') === isRemote)
      .flatMap((monitor) => asArray<StoredBlobWidget>(monitor['widgets']))
      .filter((widget) => asObject(widget)?.type === FUEL_TYPE);
  const instances = [...instancesOn(false), ...instancesOn(true)];
  const picked =
    instances.find((widget) => widget['enabled'] === true) ?? instances[0];

  if (picked) {
    return asObject(picked.settings);
  }

  const template = asObject(asObject(blob['widgetTemplates'])?.[FUEL_TYPE]);

  return asObject(template?.['settings']);
};

const liftFuelStrategy = (blob: SettingsBlob): SettingsBlob => {
  const source = fuelStrategySource(blob) ?? {};
  const app = { ...(asObject(blob['app']) ?? {}) };

  for (const [widgetKey, appKey] of Object.entries(FUEL_STRATEGY_KEYS)) {
    if (widgetKey in source && !(appKey in app)) {
      app[appKey] = source[widgetKey];
    }
  }

  const lifted = dropStoredWidgetSettings(
    blob,
    FUEL_TYPE,
    Object.keys(FUEL_STRATEGY_KEYS)
  );

  return Object.keys(app).length > 0 || 'app' in blob
    ? { ...lifted, app }
    : lifted;
};

export const v7WiderTableColumns: Migration = {
  to: 7,
  describe:
    'Standings and Relative frames widened with their columns; Fuel, Lap Log and Sector Matrix widened to their new design widths; Sector Matrix predicted lap became a visibility choice; fuel strategy moved to app',
  migrate: (blob: SettingsBlob): SettingsBlob =>
    liftFuelStrategy(
      patchStoredWidgetSettings(
        widenTemplates(
          mapEveryStoredWidget(blob, (widgets) => widgets.map(widenInstance))
        ),
        'sector-matrix',
        predictedLapVisibility
      )
    ),
};
