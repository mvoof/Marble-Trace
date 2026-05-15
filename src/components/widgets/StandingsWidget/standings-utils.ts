import type { DriverEntry } from '../../../types/bindings';
import type { StandingsWidgetSettings } from '../../../types/widget-settings';

export const computeClassSof = (drivers: DriverEntry[]): number => {
  if (drivers.length === 0) return 0;
  const total = drivers.reduce((sum, d) => sum + d.iRating, 0);
  return Math.round(total / drivers.length);
};

const ws = (px: number) => `calc(${px}px * var(--wfs, 1))`;

export const buildGridTemplate = (
  settings: StandingsWidgetSettings
): string => {
  const cols: string[] = [
    ws(20), // pos       "00"
    ws(40), // carNum    "#000"
    `minmax(${ws(30)}, 1fr)`, // name      — never collapses
    settings.showBrand ? ws(24) : '0px',
    settings.showTire ? ws(14) : '0px',
    !settings.enableClassCycling && settings.showClassBadge ? ws(34) : '0px', // class
    settings.showIRatingBadge ? ws(60) : '0px', // rating
    settings.showIrChange ? ws(22) : '0px', // change rating
    settings.showLapsCompleted ? ws(18) : '0px', // laps completed
    settings.showPosChange ? ws(20) : '0px', //change position
    ws(50), // gap       "+000.0"
    ws(70), // last      "0:00.000"
    ws(70), // best
  ];

  return cols.join(' ');
};
