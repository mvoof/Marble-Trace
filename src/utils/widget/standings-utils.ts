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
  { width: ws(20), show: true }, // pos      "00"
  { width: ws(40), show: true }, // carNum   "#000"
  { width: `minmax(${ws(30)}, 1fr)`, show: true }, // name     — never collapses
  { width: ws(30), show: settings.showBrand }, // brand
  { width: ws(16), show: settings.showTire }, // tire
  {
    width: ws(34),
    show: !settings.enableClassCycling && settings.showClassBadge,
  }, // class
  { width: ws(70), show: settings.showIRatingBadge }, // lic/iRating
  { width: ws(22), show: settings.showIrChange }, // ΔiR
  { width: ws(18), show: settings.showLapsCompleted }, // laps
  { width: ws(22), show: settings.showPosChange }, // +/- pos
  { width: ws(50), show: true }, // gap      "+000.0"
  { width: ws(70), show: true }, // last     "0:00.000"
  { width: ws(70), show: true }, // best     "0:00.000"
];

export const buildGridTemplate = (settings: StandingsWidgetSettings): string =>
  buildColDefs(settings)
    .filter((col) => col.show)
    .map((col) => col.width)
    .join(' ');
