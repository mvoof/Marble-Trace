import type { DriverEntry } from '../../../types/bindings';
import type { StandingsWidgetSettings } from '../../../types/widget-settings';

export const computeClassSof = (drivers: DriverEntry[]): number => {
  if (drivers.length === 0) return 0;
  const total = drivers.reduce((sum, d) => sum + d.iRating, 0);
  return Math.round(total / drivers.length);
};

export const buildGridTemplate = (
  settings: StandingsWidgetSettings
): string => {
  const cols: string[] = [
    '2.5ch', // pos
    '4ch', // car number
    '1fr', // name
  ];

  if (settings.showBrand) cols.push('4ch');
  if (settings.showTire) cols.push('2.5ch');
  if (!settings.enableClassCycling && settings.showClassBadge) cols.push('4ch');
  if (settings.showIRatingBadge) cols.push('8ch');
  if (settings.showIrChange) cols.push('4ch');
  if (settings.showPitStops) cols.push('3.5ch');
  if (settings.showLapsCompleted) cols.push('3.5ch');
  if (settings.showPosChange) cols.push('3.5ch');

  cols.push('7ch'); // gap
  cols.push('8.5ch'); // last lap
  cols.push('8.5ch'); // best lap

  return cols.join(' ');
};
