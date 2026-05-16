import type { DriverEntry } from '../../../types/bindings';
import type { StandingsWidgetSettings } from '../../../types/widget-settings';

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
  { width: ws(24), show: settings.showBrand }, // brand
  { width: ws(14), show: settings.showTire }, // tire
  {
    width: ws(34),
    show: !settings.enableClassCycling && settings.showClassBadge,
  }, // class
  { width: ws(60), show: settings.showIRatingBadge }, // lic/iRating
  { width: ws(22), show: settings.showIrChange }, // ΔiR
  { width: ws(18), show: settings.showLapsCompleted }, // laps
  { width: ws(20), show: settings.showPosChange }, // +/- pos
  { width: ws(50), show: true }, // gap      "+000.0"
  { width: ws(70), show: true }, // last     "0:00.000"
  { width: ws(70), show: true }, // best     "0:00.000"
];

export const buildGridTemplate = (settings: StandingsWidgetSettings): string =>
  buildColDefs(settings)
    .filter((col) => col.show)
    .map((col) => col.width)
    .join(' ');
