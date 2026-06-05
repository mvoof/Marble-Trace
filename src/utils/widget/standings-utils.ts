import type { DriverEntry } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';

export const sliceWithPlayerPin = (
  drivers: DriverEntry[],
  budget: number
): DriverEntry[] => {
  if (budget <= 0) {
    return [];
  }

  if (drivers.length <= budget) {
    return drivers;
  }

  const playerIdx = drivers.findIndex((driver) => driver.isPlayer);
  const visible = drivers.slice(0, budget);

  if (playerIdx >= budget && budget >= 2) {
    visible[budget - 1] = drivers[playerIdx];
  }

  return visible;
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

export const computeClassSof = (drivers: DriverEntry[]): number => {
  if (drivers.length === 0) return 0;
  const total = drivers.reduce((sum, d) => sum + d.iRating, 0);
  return Math.round(total / drivers.length);
};

const ws = (px: number) => `calc(${px}px * var(--wfs, 1))`;

// Layout constants — must mirror the SCSS: column-gap sp(xxxs)=2, padding sp(md)=10.
const COL_GAP_PX = 2;
const ROW_PAD_X_PX = 10;
// Name column flexes (minmax → 1fr); NAME_MIN never truncates, NAME_NATURAL is
// the comfortable width used when computing the widget's natural design width.
const NAME_MIN_PX = 120;
const NAME_NATURAL_PX = 160;

// Single source of truth for column order + widths (px at scale 1). Order here
// MUST match the render order in DriverRow.tsx and StandingsHeader.tsx.
interface ColSpec {
  px: number;
  show: boolean;
  flex?: boolean; // the name column — minmax(NAME_MIN, 1fr)
}

const colSpecs = (settings: StandingsWidgetSettings): ColSpec[] => [
  { px: 22, show: true }, // pos      "00" (fs lg, bold)
  { px: 46, show: true }, // carNum   "#000" + cell padding
  { px: NAME_NATURAL_PX, show: true, flex: true }, // name — flexes, never collapses
  { px: 54, show: settings.showLicBadge }, // lic badge "A 4.99"
  { px: 42, show: settings.showIRating }, // iRating  "9.9k"
  { px: 42, show: settings.showIrChange }, // ΔiR     "+123"
  { px: 28, show: settings.showLapsCompleted }, // laps "00"
  { px: 38, show: settings.showPosChange }, // +/- pos  "▲12"
  { px: 50, show: true }, // gap      "+123.4" / "12 L"
  { px: 74, show: true }, // last     "0:00.000"
  { px: 74, show: true }, // best     "0:00.000"
  { px: 36, show: settings.showBrand }, // brand    "MERC" — at end
  { px: 30, show: settings.showTire }, // tire     badge — at end
];

export const buildGridTemplate = (settings: StandingsWidgetSettings): string =>
  colSpecs(settings)
    .filter((col) => col.show)
    .map((col) => (col.flex ? `minmax(${ws(NAME_MIN_PX)}, 1fr)` : ws(col.px)))
    .join(' ');

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

      return { value: '-', isLeader: true, isEmpty: false };
    }

    return { value: '--.-', isLeader: false, isEmpty: true };
  }

  // In race, try to use Session ResultsPositions gap data
  const resLap = driver.resultsPositionLap;
  const resTime = driver.resultsPositionTime;

  if (
    resLap !== undefined &&
    resLap !== null &&
    resTime !== undefined &&
    resTime !== null
  ) {
    if (resLap !== 0) {
      return { value: `${resLap} L`, isLeader: false, isEmpty: false };
    }

    if (resTime > 0) {
      return { value: resTime.toFixed(1), isLeader: false, isEmpty: false };
    }

    return { value: '-', isLeader: true, isEmpty: false };
  }

  // Fallback if resultsPosition values are not available (e.g. at the start of a session)
  if (lapsBehind >= 1) {
    return { value: `${lapsBehind} L`, isLeader: false, isEmpty: false };
  }

  if (driver.f2Time > 0) {
    return {
      value: driver.f2Time.toFixed(1),
      isLeader: false,
      isEmpty: false,
    };
  }

  return { value: '--.-', isLeader: false, isEmpty: true };
};
