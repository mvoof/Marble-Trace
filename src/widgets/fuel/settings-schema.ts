import {
  bool,
  choice,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const FUEL_SETTINGS = defineSettings('fuel', {
  showChart: bool(false),
  showNextStopForecast: bool(true),
  chartType: choice(['line', 'bar'], 'bar'),
  /** Width of one lap on the chart, in px. */
  barWidth: num(5, { min: 5, max: 20 }),
  showStatLast: bool(true),
  // A historical key, persisted as-is: the column averages every recorded
  // lap, not ten of them.
  showStatAvg10: bool(true),
  showStatMin: bool(true),
  showStatMax: bool(true),
});

export type FuelWidgetSettings = SettingsOf<typeof FUEL_SETTINGS.shape>;
