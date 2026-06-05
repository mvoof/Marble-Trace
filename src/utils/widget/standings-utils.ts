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

type ColDef = { width: string; show: boolean };

const buildColDefs = (settings: StandingsWidgetSettings): ColDef[] => [
  { width: ws(23), show: true }, // pos      "00"
  { width: ws(44), show: true }, // carNum   "#000"
  { width: `minmax(${ws(112)}, 1fr)`, show: true }, // name     — never collapses
  { width: ws(22), show: settings.showBrand }, // brand
  { width: ws(22), show: settings.showTire }, // tire
  { width: ws(58), show: settings.showLicBadge }, // lic badge
  { width: ws(40), show: settings.showIRating }, // iRating value
  { width: ws(40), show: settings.showIrChange }, // ΔiR
  { width: ws(28), show: settings.showLapsCompleted }, // laps
  { width: ws(38), show: settings.showPosChange }, // +/- pos
  { width: ws(38), show: true }, // gap      "+000.0"
  { width: ws(80), show: true }, // last     "0:00.000"
  { width: ws(80), show: true }, // best     "0:00.000"
];

export const buildGridTemplate = (settings: StandingsWidgetSettings): string =>
  buildColDefs(settings)
    .filter((col) => col.show)
    .map((col) => col.width)
    .join(' ');

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
