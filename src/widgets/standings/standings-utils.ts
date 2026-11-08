import type { CarIdentity } from '@shared/contracts/car-identity';
import type { DriverEntry } from '@shared/contracts/driver-entry';
import {
  chipColumnCss,
  columnPx,
  ratingChipParts,
  ratingChipWidth,
} from '@shared/ui/StatChip/rating';
import { formatLapTime } from '@shared/lib/telemetry-format';
import type { StandingsWidgetSettings } from './settings-schema';

export interface VisibleRows {
  drivers: CarIdentity[];
  /** Index of the first row of the "around the player" block, or -1 when there is none. */
  windowStartIndex: number;
}

const NO_WINDOW: number = -1;
// The top block must keep at least the leader when a player window is carved out.
const MIN_TOP_ROWS = 1;

/** Rows the list can be scrolled down by before the last driver reaches the bottom. */
export const maxScrollOffset = (totalDrivers: number, maxRows: number) =>
  Math.max(0, totalDrivers - maxRows);

/**
 * Picks the rows to render: the top of the table, plus — when the plain slice
 * would not show the player together with the cars behind them — either a
 * single pinned player row (`requestedAhead` and `requestedBehind` both 0) or a
 * contiguous window of that many cars around them.
 */
export const buildVisibleRows = (
  drivers: CarIdentity[],
  maxRows: number,
  requestedAhead: number,
  requestedBehind: number,
  scrollOffset = 0
): VisibleRows => {
  if (maxRows <= 0) {
    return { drivers: [], windowStartIndex: NO_WINDOW };
  }

  if (drivers.length <= maxRows) {
    return { drivers, windowStartIndex: NO_WINDOW };
  }

  // Scrolling moves the top block down the field; the player window stays pinned
  // to the bottom until the block itself reaches the player and absorbs it.
  const start = Math.min(
    scrollOffset,
    maxScrollOffset(drivers.length, maxRows)
  );

  const playerIndex = drivers.findIndex((driver) => driver.isPlayer);

  // Rows that actually exist behind the player. A short field must not be padded
  // from the other side — a driver ahead rendered below the player (or the
  // reverse) would read as the wrong side of the fight.
  const availableBehind = Math.max(
    0,
    Math.min(requestedBehind, drivers.length - 1 - playerIndex)
  );

  // The plain slice is enough while the player is on it *with* the rows behind
  // them — sitting on its last row, the driver sees nobody chasing them, which
  // is exactly what the setting was turned on for. Scrolled past the player,
  // the user is reading the field on purpose and the window stays out of it.
  const plainSliceIsEnough =
    playerIndex < start || playerIndex + availableBehind < start + maxRows;

  if (playerIndex < 0 || plainSliceIsEnough) {
    return {
      drivers: drivers.slice(start, start + maxRows),
      windowStartIndex: NO_WINDOW,
    };
  }

  if (requestedAhead === 0 && requestedBehind === 0) {
    const topBlock = drivers.slice(start, start + maxRows);

    topBlock[topBlock.length - 1] = drivers[playerIndex];

    return { drivers: topBlock, windowStartIndex: NO_WINDOW };
  }

  const availableAhead = Math.max(
    0,
    Math.min(requestedAhead, playerIndex - start - MIN_TOP_ROWS)
  );

  // Rows the requested window asks for beyond what is left once the top block
  // keeps its leader. Trimmed from the back first: the car you are chasing
  // matters more than the one chasing you.
  const excessRows = Math.max(
    0,
    availableAhead + 1 + availableBehind - (maxRows - MIN_TOP_ROWS)
  );

  const behindRows = Math.max(0, availableBehind - excessRows);
  // Clamped at zero: a single available row cannot hold both the leader and the
  // player, and the window the player sits in wins — a standings block without
  // the player row is useless.
  const aheadRows = Math.max(
    0,
    availableAhead - Math.max(0, excessRows - availableBehind)
  );

  const windowRowCount = aheadRows + 1 + behindRows;
  const topRowCount = maxRows - windowRowCount;
  const windowStart = playerIndex - aheadRows;

  // The two blocks touch (or the window has eaten the whole budget): there is no
  // gap to mark, so one contiguous slice ending below the player is rendered.
  if (windowStart <= start + topRowCount) {
    const end = Math.min(drivers.length, playerIndex + behindRows + 1);

    return {
      drivers: drivers.slice(Math.max(0, end - maxRows), end),
      windowStartIndex: NO_WINDOW,
    };
  }

  const visibleDrivers = [
    ...drivers.slice(start, start + topRowCount),
    ...drivers.slice(windowStart, windowStart + windowRowCount),
  ];

  return { drivers: visibleDrivers, windowStartIndex: topRowCount };
};

export const parseWeekendTemp = (
  tempStr: string | null | undefined
): number | null => {
  if (tempStr == null) {
    return null;
  }

  const num = parseFloat(tempStr);

  return isNaN(num) ? null : num;
};

const ws = (px: number) => `calc(${px}px * var(--wfs, 1))`;

// Layout constants — must mirror the SCSS: column-gap sp(xxxs)=2, padding sp(md)=10.
const COL_GAP_PX = 2;
const ROW_PAD_X_PX = 10;
// Inner padding on each side of a value cell — sp(xxs) in the SCSS — so a value
// never touches the edge of its column stripe. Position and name carry their own.
const CELL_PAD_X_PX = 4;

const padded = (contentPx: number): number => contentPx + CELL_PAD_X_PX * 2;

// The name column is fixed, not elastic: an elastic name swallows every pixel
// freed by a hidden column, so the only way left to narrow the table is to drag
// its edge — which scales the text down with it. Its width is a user setting,
// bounded so a name is neither unreadable nor wider than the rest of the table.
export const NAME_COLUMN_MIN_PX = 80;
export const NAME_COLUMN_MAX_PX = 320;
export const NAME_COLUMN_DEFAULT_PX = 200;

const clampNameColumnWidth = (width: number | undefined) => {
  if (!Number.isFinite(width)) {
    return NAME_COLUMN_DEFAULT_PX;
  }

  return Math.min(
    NAME_COLUMN_MAX_PX,
    Math.max(NAME_COLUMN_MIN_PX, Math.round(width as number))
  );
};

// Single source of truth for column order + widths (px at scale 1). Order here
// MUST match the render order in DriverRow.tsx and StandingsHeader.tsx.
export type StandingsColumn =
  | 'pos'
  | 'carNumber'
  | 'posChange'
  | 'countryFlag'
  | 'name'
  | 'rating'
  | 'irChange'
  | 'laps'
  | 'gap'
  | 'interval'
  | 'lastLap'
  | 'lapDelta'
  | 'bestLap'
  | 'brand'
  | 'tire';

/**
 * The groups a thin rule divides the row into: who the driver is, how rated,
 * where in the race, how fast, in what car. Rules sit between groups, never
 * between the columns of one.
 */
type ColumnBlock = 'driver' | 'rating' | 'race' | 'times' | 'car';

interface ColSpec {
  key: StandingsColumn;
  block: ColumnBlock;
  px: number;
  /** The track as CSS, when it is more than `px` at the widget's scale. */
  css?: string;
  show: boolean;
}

// The rating column: the chip's own width and the cell's padding, growing with
// the font scale as the chip's digits do.
const ratingColumn = (
  settings: StandingsWidgetSettings
): { px: number; css: string } => {
  const { sr, ir } = ratingChipParts(settings);
  const width = ratingChipWidth(sr, ir, settings.licBadgeStyle);

  return {
    px: columnPx(width, CELL_PAD_X_PX * 2),
    css: chipColumnCss(width, CELL_PAD_X_PX * 2),
  };
};

const colSpecs = (settings: StandingsWidgetSettings): ColSpec[] => [
  { key: 'pos', block: 'driver', px: 28, show: true }, // "00" (fs md, bold)
  { key: 'carNumber', block: 'driver', px: padded(40), show: true }, // class-colored badge
  {
    key: 'posChange',
    block: 'driver',
    px: padded(38),
    show: settings.showPosChange,
  }, // "▲12"
  {
    key: 'countryFlag',
    block: 'driver',
    px: padded(22),
    show: settings.showCountryFlag,
  }, // right before the name
  {
    key: 'name',
    block: 'driver',
    px: clampNameColumnWidth(settings.nameColumnWidth),
    show: true,
  }, // fixed, user-sized
  {
    // Safety rating and iRating, one chip whichever of the two is shown. The
    // column is the chip's own width plus the cell padding, so a format switch
    // moves the column by what the chip gained or lost and nothing else.
    key: 'rating',
    block: 'rating',
    ...ratingColumn(settings),
    show: settings.showLicBadge || settings.showIRating,
  },
  {
    key: 'irChange',
    block: 'rating',
    px: padded(42),
    show: settings.showIrChange,
  }, // "+123"
  {
    key: 'laps',
    block: 'race',
    px: padded(28),
    show: settings.showLapsCompleted,
  }, // "00"
  { key: 'gap', block: 'race', px: padded(50), show: settings.showGap }, // "+123.4" / "12 L" / "LDR"
  {
    key: 'interval',
    block: 'race',
    px: padded(50),
    show: settings.showInterval,
  }, // "123.4" / "12 L"
  {
    key: 'lastLap',
    block: 'times',
    px: padded(82),
    show: settings.showLastLap,
  }, // "1:32.400" (9 chars mono max)
  {
    key: 'lapDelta',
    block: 'times',
    px: padded(50),
    show: settings.showLapDelta,
  }, // "12.34"
  {
    key: 'bestLap',
    block: 'times',
    px: padded(82),
    show: settings.showBestLap,
  }, // "1:32.400" (9 chars mono max)
  { key: 'brand', block: 'car', px: padded(36), show: settings.showBrand }, // "MERC" — at end
  { key: 'tire', block: 'car', px: padded(30), show: settings.showTire }, // badge — at end
];

/**
 * The visible columns that close a group with another group after them — the
 * cells that carry the thin rule on their right edge. The last group carries
 * none: the row's own edge closes it.
 */
export const buildBlockEndColumns = (
  settings: StandingsWidgetSettings
): ReadonlySet<StandingsColumn> => {
  const visible = colSpecs(settings).filter((col) => col.show);
  const ends = new Set<StandingsColumn>();

  visible.forEach((col, index) => {
    const next = visible[index + 1];

    if (next !== undefined && next.block !== col.block) {
      ends.add(col.key);
    }
  });

  return ends;
};

export const buildGridTemplate = (
  settings: StandingsWidgetSettings
): string => {
  const parts: string[] = [];

  for (const col of colSpecs(settings)) {
    if (col.show) {
      parts.push(col.css ?? ws(col.px));
    }
  }

  return parts.join(' ');
};

// Natural content width of the currently-visible columns (px at scale 1).
// Used as the widget's designWidth so hiding columns shrinks the widget WITHOUT
// shrinking text: --wfs = currentWidth / designWidth stays put when both move
// together (see resolveStandingsLayout in widget-defaults).
export const computeStandingsDesignWidth = (
  settings: StandingsWidgetSettings
): number => {
  const visible = colSpecs(settings).filter((col) => col.show);
  const columnsWidth = visible.reduce((sum, col) => sum + col.px, 0);
  const gaps = Math.max(0, visible.length - 1) * COL_GAP_PX;

  return Math.round(columnsWidth + gaps + ROW_PAD_X_PX * 2);
};

interface DriverLapInfo {
  lap: number;
  lapDistPct: number;
}

export const calculateLapsBehind = (
  leader: DriverLapInfo | null | undefined,
  driver: DriverLapInfo
): number => {
  if (!leader) return 0;
  const leaderAbs = leader.lap + leader.lapDistPct;
  const driverAbs = driver.lap + driver.lapDistPct;
  return Math.floor(leaderAbs - driverAbs);
};

export interface BestLapDisplay {
  time: number | null;
  isQualifying: boolean;
}

/**
 * What the Best column shows. Until a car completes a lap of its own it has no
 * best lap, and in a race that lasts from the grid until the first crossing —
 * the whole time the column would otherwise sit empty. The qualifying time
 * stands in there, marked so it is never read as a lap set in this session.
 */
export const resolveBestLapDisplay = (driver: CarIdentity): BestLapDisplay => {
  if (driver.bestLapTime !== null) {
    return { time: driver.bestLapTime, isQualifying: false };
  }

  if (driver.qualifyTime !== null) {
    return { time: driver.qualifyTime, isQualifying: true };
  }

  return { time: null, isQualifying: false };
};

export interface StandingsGapInfo {
  value: string;
  isLeader: boolean;
  isEmpty: boolean;
}

// Short enough for a chip in the gap column.
const LEADER_LABEL = 'LDR';

/** What a table cell holds when it has no value — drawn centred. */
export const EMPTY_VALUE = '-';

/** A lap time for the Last and Best columns, or the empty dash without one. */
export const formatLapCell = (seconds: number | null): string =>
  seconds === null || seconds <= 0 ? EMPTY_VALUE : formatLapTime(seconds);

const SECONDS_PER_MINUTE = 60;

/**
 * Time on pit road, short enough for a badge: tenths under a minute
 * ("23.5s"), minutes and whole seconds past it ("1:32").
 */
export const formatPitStopTime = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) {
    return '-';
  }

  if (seconds < SECONDS_PER_MINUTE) {
    return `${seconds.toFixed(1)}s`;
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / SECONDS_PER_MINUTE);
  const remainder = wholeSeconds % SECONDS_PER_MINUTE;

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const LAP_DELTA_DECIMALS = 2;

export type LapDeltaTone = 'faster' | 'slower' | 'even';

export interface LapDeltaDisplay {
  value: string;
  tone: LapDeltaTone;
}

/**
 * The Delta column: the last lap against the one before it, unsigned, to two
 * decimals — the colour alone says faster or slower. A delta that rounds to
 * zero is neither.
 */
export const formatLapDelta = (delta: number | undefined): LapDeltaDisplay => {
  if (delta === undefined || !Number.isFinite(delta)) {
    return { value: EMPTY_VALUE, tone: 'even' };
  }

  const rounded = Number(delta.toFixed(LAP_DELTA_DECIMALS));

  if (rounded === 0) {
    return { value: (0).toFixed(LAP_DELTA_DECIMALS), tone: 'even' };
  }

  if (rounded < 0) {
    return {
      value: Math.abs(rounded).toFixed(LAP_DELTA_DECIMALS),
      tone: 'faster',
    };
  }

  return { value: rounded.toFixed(LAP_DELTA_DECIMALS), tone: 'slower' };
};

/**
 * The interval: the same measurement as the gap, taken against the car
 * directly ahead instead of the leader. The leader has no car ahead.
 */
export const getStandingsInterval = (
  driver: DriverEntry,
  carAhead: DriverEntry | null,
  isRace: boolean
): StandingsGapInfo => {
  if (carAhead === null) {
    return { value: EMPTY_VALUE, isLeader: false, isEmpty: true };
  }

  return getStandingsGap(
    driver,
    carAhead,
    isRace,
    false,
    calculateLapsBehind(carAhead, driver)
  );
};

export const getStandingsGap = (
  driver: DriverEntry,
  leader: DriverEntry | null,
  isRace: boolean,
  isLeader: boolean,
  lapsBehind: number
): StandingsGapInfo => {
  if (isLeader) {
    return { value: LEADER_LABEL, isLeader: true, isEmpty: false };
  }

  if (!isRace) {
    if (
      driver.bestLapTime !== null &&
      leader !== null &&
      leader.bestLapTime !== null
    ) {
      const timeDiff = driver.bestLapTime - leader.bestLapTime;

      if (timeDiff > 0) {
        return { value: timeDiff.toFixed(1), isLeader: false, isEmpty: false };
      }

      return { value: EMPTY_VALUE, isLeader: false, isEmpty: true };
    }

    return { value: EMPTY_VALUE, isLeader: false, isEmpty: true };
  }

  // In race, try to use Session ResultsPositions gap data. Everything the sim
  // reports — `ResultsPositions` and `CarIdxF2Time` alike — is measured against
  // the *overall* leader; there is no per-class gap field. Subtracting the
  // leader row's own gap re-bases it onto whoever the caller passed in, so the
  // class views measure against the class leader and the overall view is
  // unchanged (the overall leader's gap is zero).
  const resLap = driver.resultsPositionLap;
  const resTime = driver.resultsPositionTime;

  if (
    resLap !== undefined &&
    resLap !== null &&
    resTime !== undefined &&
    resTime !== null
  ) {
    const leaderLap = leader?.resultsPositionLap ?? 0;
    const leaderTime = leader?.resultsPositionTime ?? 0;

    const lapsDown = resLap - leaderLap;

    if (lapsDown > 0) {
      return { value: `${lapsDown} L`, isLeader: false, isEmpty: false };
    }

    // A lapped leader row would make the time difference meaningless — the two
    // gaps are then measured over a different number of laps.
    if (lapsDown === 0) {
      const timeDiff = resTime - leaderTime;

      if (timeDiff > 0) {
        return { value: timeDiff.toFixed(1), isLeader: false, isEmpty: false };
      }
    }

    // Only the row the caller marked as leader may render as leader. A
    // non-positive difference here means the reference row is not actually
    // ahead of this car — showing a second '-' would read as a second leader.
    return { value: EMPTY_VALUE, isLeader: false, isEmpty: true };
  }

  // Fallback if resultsPosition values are not available (e.g. at the start of a
  // session). `lapsBehind` is already measured against the leader passed in.
  if (lapsBehind >= 1) {
    return { value: `${lapsBehind} L`, isLeader: false, isEmpty: false };
  }

  const f2Diff = driver.f2Time - (leader?.f2Time ?? 0);

  if (f2Diff > 0) {
    return {
      value: f2Diff.toFixed(1),
      isLeader: false,
      isEmpty: false,
    };
  }

  return { value: EMPTY_VALUE, isLeader: false, isEmpty: true };
};

const UNLIMITED_LAPS = 'unlimited';

// Replaces the count on the last lap — the fact matters more than the number.
const FINAL_LAP_LABEL = 'FINAL';

export interface LapProgress {
  value: string;
  isFinalLap: boolean;
  /** Longest the value can grow to, so the pill reserves its width up front. */
  widthChars: number;
}

/**
 * The leader's lap against the session length. On the last lap the count is
 * replaced by the fact that matters more than the number.
 */
export const buildLapProgress = (
  leaderLap: number | null,
  totalLaps: string | null,
  isEstimated: boolean
): LapProgress | null => {
  if (leaderLap === null) {
    return null;
  }

  if (totalLaps === null || totalLaps.toLowerCase() === UNLIMITED_LAPS) {
    return {
      value: String(leaderLap),
      isFinalLap: false,
      widthChars: String(leaderLap).length,
    };
  }

  const totalCount = Number(totalLaps);
  const isFinalLap =
    !isEstimated && Number.isFinite(totalCount) && leaderLap >= totalCount;

  // Width is reserved for the widest lap the session can reach, not for the
  // one on screen — otherwise the header shifts on the way from 9 to 10.
  const widthChars = Math.max(
    FINAL_LAP_LABEL.length,
    totalLaps.length * 2 + (isEstimated ? 2 : 1)
  );

  if (isFinalLap) {
    return { value: FINAL_LAP_LABEL, isFinalLap: true, widthChars };
  }

  const value = `${leaderLap}/${isEstimated ? `~${totalLaps}` : totalLaps}`;

  return { value, isFinalLap: false, widthChars };
};

/**
 * Whether the table itself draws per-class headers — grouped stacks one above
 * each class, cycling shows the one class on screen. Both carry that class's own
 * SOF, so the field-wide average in the session header is at best a duplicate
 * and in multiclass a number that describes no one.
 */
export const drawsClassHeaders = (
  viewMode: StandingsWidgetSettings['viewMode'],
  classGroupCount: number
): boolean =>
  (viewMode === 'grouped' || viewMode === 'cycling') && classGroupCount > 0;
