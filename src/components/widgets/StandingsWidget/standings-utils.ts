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
    '2ch', // pos    numeric, tabular
    '3.5ch', // carNum numeric, tabular
    '1fr', // name   — fills remaining space
  ];

  // Badge columns use em (like RelativeWidget) so they scale with widget font-size
  if (settings.showBrand) cols.push('3em');
  if (settings.showTire) cols.push('1.75em');
  if (!settings.enableClassCycling && settings.showClassBadge)
    cols.push('2.5em');
  if (settings.showIRatingBadge) cols.push('4.5em');

  // Numeric/delta columns use ch
  if (settings.showIrChange) cols.push('3.5ch');
  if (settings.showPitStops) cols.push('3ch');
  if (settings.showLapsCompleted) cols.push('2ch');
  if (settings.showPosChange) cols.push('3ch');

  cols.push('6ch'); // gap    "+000.0"
  cols.push('8ch'); // last   "0:00.000"
  cols.push('8ch'); // best

  return cols.join(' ');
};
