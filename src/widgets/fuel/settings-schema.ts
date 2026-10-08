import {
  DEFAULT_PIT_WARNING_LAPS,
  FUEL_AVG_WINDOW_ALL_LAPS,
  FUEL_AVG_WINDOW_MAX,
} from '@shared/contracts/backend-constants';
import {
  bool,
  choice,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const FUEL_SETTINGS = defineSettings('fuel', {
  showChart: bool(false),
  pitWarningLaps: num(DEFAULT_PIT_WARNING_LAPS, { min: 1, max: 20 }),
  /** Laps averaged for consumption; 0 = every lap of the session. */
  fuelAvgWindow: num(FUEL_AVG_WINDOW_ALL_LAPS, {
    min: FUEL_AVG_WINDOW_ALL_LAPS,
    max: FUEL_AVG_WINDOW_MAX,
    step: 1,
  }),
  /** Count laps under a local yellow; full-course cautions are always dropped. */
  countYellowFlagLaps: bool(false),
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
