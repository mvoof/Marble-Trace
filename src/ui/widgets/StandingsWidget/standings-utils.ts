import type { DriverEntry } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';

export interface VisibleRows {
  drivers: DriverEntry[];
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
 * Picks the rows to render: the top of the table, plus — when the player has
 * dropped out of it — either a single pinned player row (`requestedAhead` and
 * `requestedBehind` both 0) or a contiguous window of that many cars around them.
 */
export const buildVisibleRows = (
  drivers: DriverEntry[],
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

  if (playerIndex < 0 || playerIndex < start + maxRows) {
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

  // Rows that actually exist on each side of the player. A short field must not
  // be padded from the other side — a driver ahead rendered below the player (or
  // the reverse) would read as the wrong side of the fight.
  const availableBehind = Math.min(
    requestedBehind,
    drivers.length - 1 - playerIndex
  );

  const availableAhead = Math.min(
    requestedAhead,
    playerIndex - start - MIN_TOP_ROWS
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

  const visibleDrivers = [
    ...drivers.slice(start, start + topRowCount),
    ...drivers.slice(windowStart, windowStart + windowRowCount),
  ];

  return {
    drivers: visibleDrivers,
    windowStartIndex:
      windowStart > start + topRowCount ? topRowCount : NO_WINDOW,
  };
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
// Name column flexes (minmax → 1fr); NAME_MIN never truncates, NAME_NATURAL is
// the comfortable width used when computing the widget's natural design width.
const NAME_MIN_PX = 120;
const NAME_NATURAL_PX = 200;

// Single source of truth for column order + widths (px at scale 1). Order here
// MUST match the render order in DriverRow.tsx and StandingsHeader.tsx.
interface ColSpec {
  px: number;
  show: boolean;
  flex?: boolean; // the name column — minmax(NAME_MIN, 1fr)
}

const colSpecs = (settings: StandingsWidgetSettings): ColSpec[] => [
  { px: 28, show: true }, // pos      "00" (fs md, bold)
  { px: 40, show: true }, // carNum   class-colored badge, right after pos
  { px: 38, show: settings.showPosChange }, // +/- pos  "▲12"
  { px: NAME_NATURAL_PX, show: true, flex: true }, // name — flexes, never collapses
  { px: 60, show: settings.showLicBadge }, // lic badge "A 4.99" — matches Relative for equal PIT↔SR gap
  { px: 42, show: settings.showIRating }, // iRating  "9.9k"
  { px: 42, show: settings.showIrChange }, // ΔiR     "+123"
  { px: 28, show: settings.showLapsCompleted }, // laps "00"
  { px: 50, show: true }, // gap      "+123.4" / "12 L"
  { px: 82, show: true }, // last     "--:--.---" (9 chars mono)
  { px: 82, show: true }, // best     "--:--.---" (9 chars mono)
  { px: 36, show: settings.showBrand }, // brand    "MERC" — at end
  { px: 30, show: settings.showTire }, // tire     badge — at end
];

export const buildGridTemplate = (
  settings: StandingsWidgetSettings
): string => {
  const parts: string[] = [];

  for (const col of colSpecs(settings)) {
    if (col.show) {
      parts.push(col.flex ? `minmax(${ws(NAME_MIN_PX)}, 1fr)` : ws(col.px));
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
export const resolveBestLapDisplay = (driver: DriverEntry): BestLapDisplay => {
  if (driver.bestLapTime > 0) {
    return { time: driver.bestLapTime, isQualifying: false };
  }

  if (driver.qualifyTime > 0) {
    return { time: driver.qualifyTime, isQualifying: true };
  }

  return { time: null, isQualifying: false };
};

export interface StandingsGapInfo {
  value: string;
  isLeader: boolean;
  isEmpty: boolean;
}

export const getStandingsGap = (
  driver: DriverEntry,
  leader: DriverEntry | null,
  isRace: boolean,
  isLeader: boolean,
  lapsBehind: number
): StandingsGapInfo => {
  if (isLeader) {
    return { value: '-', isLeader: true, isEmpty: false };
  }

  if (!isRace) {
    if (driver.bestLapTime > 0 && leader && leader.bestLapTime > 0) {
      const timeDiff = driver.bestLapTime - leader.bestLapTime;

      if (timeDiff > 0) {
        return { value: timeDiff.toFixed(1), isLeader: false, isEmpty: false };
      }

      return { value: '--.-', isLeader: false, isEmpty: true };
    }

    return { value: '--.-', isLeader: false, isEmpty: true };
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
    return { value: '--.-', isLeader: false, isEmpty: true };
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

  return { value: '--.-', isLeader: false, isEmpty: true };
};

const UNLIMITED_LAPS = 'unlimited';

// Replaces the count on the last lap — the fact matters more than the number.
const FINAL_LAP_LABEL = 'FINAL';

/**
 * A lap-limited race counts down laps; a timed one counts down the clock. The
 * one that ends the session is the header's lead value, the other is secondary.
 */
export const isLapLimitedSession = (
  sessionLaps: string | null | undefined
): boolean =>
  Boolean(sessionLaps) && sessionLaps!.toLowerCase() !== UNLIMITED_LAPS;

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
