import type { Migration, SettingsBlob } from '../types';
import { asObject, mapEveryStoredWidget, type StoredBlobWidget } from '../blob';

/**
 * v6 → v7. The Standings and Relative columns grew wider.
 *
 * Every value cell gained a little padding on both sides, Standings gained
 * two columns shown by default — the interval and the lap delta — and the
 * safety rating and iRating merged into one chip whose column is the chip's own
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
 */

type TableSettings = Record<string, unknown>;

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

// The rating chip of v7, frozen: JetBrains Mono digits at 11px, the solid lead
// tracked 0.06em, its padding, the iRating's padding and the chip's edges.
const RATING_ADVANCE_PX = 0.6 * 11;
const RATING_SOLID_ADVANCE_PX = (0.6 + 0.06) * 11;
const RATING_SOLID_PAD_PX = 16;
const RATING_TINT_PAD_PX = 12;
const RATING_VALUE_PAD_PX = 16;
const RATING_EDGE_PX = 2;

interface Column {
  show: (settings: TableSettings) => boolean;
  /** Whether it shows in v7, when that differs from v6. */
  showAfter?: (settings: TableSettings) => boolean;
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

const showsRating = (settings: TableSettings): boolean =>
  flag('showLicBadge', true)(settings) || flag('showIRating', true)(settings);

/** The v7 rating column: the chip of whichever parts are shown, padded. */
const ratingChipWidth: WidthOf = (settings) => {
  const isSolid = settings['licBadgeStyle'] !== 'dark';
  const showsSr = flag('showLicBadge', true)(settings);
  const showsIr = flag('showIRating', true)(settings);
  const srChars = !showsSr
    ? 0
    : flag('showLicenseLetter', true)(settings)
      ? 6
      : 4;
  const irChars = !showsIr
    ? 0
    : flag('abbreviateIRating', true)(settings)
      ? 4
      : 5;

  const srPx =
    srChars === 0
      ? 0
      : isSolid
        ? RATING_SOLID_PAD_PX + srChars * RATING_SOLID_ADVANCE_PX
        : RATING_TINT_PAD_PX + srChars * RATING_ADVANCE_PX;
  const irPx =
    irChars === 0 ? 0 : RATING_VALUE_PAD_PX + irChars * RATING_ADVANCE_PX;

  return Math.ceil(srPx + irPx + RATING_EDGE_PX + CELL_PAD_X_PX * 2);
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
    showAfter: showsRating,
    before: licWidth,
    after: ratingChipWidth,
  },
  {
    show: flag('showIRating', true),
    before: iRatingWidth(42, 52),
    after: null,
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
    after: fixed(padded(82)),
  },
  { show: flag('showLapDelta', true), before: null, after: fixed(padded(50)) },
  {
    show: flag('showBestLap', true),
    before: fixed(82),
    after: fixed(padded(82)),
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
    showAfter: showsRating,
    before: licWidth,
    after: ratingChipWidth,
  },
  {
    show: flag('showIRating', true),
    before: iRatingWidth(36, 48),
    after: null,
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
  const shows = (column: Column): boolean =>
    side === 'after' && column.showAfter !== undefined
      ? column.showAfter(settings)
      : column.show(settings);

  const widths = columns
    .filter((column) => column[side] !== null && shows(column))
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

const widenInstance = (widget: StoredBlobWidget): StoredBlobWidget => {
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

  return { ...blob, widgetTemplates: widened };
};

export const v7WiderTableColumns: Migration = {
  to: 7,
  describe: 'Standings and Relative frames widened with their columns',
  migrate: (blob: SettingsBlob): SettingsBlob =>
    widenTemplates(
      mapEveryStoredWidget(blob, (widgets) => widgets.map(widenInstance))
    ),
};
