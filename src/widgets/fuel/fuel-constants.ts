import { PIT_WINDOW_END_BUFFER_LAPS } from '@shared/contracts/generated/backend-constants';

/**
 * Shared constants and thresholds for the FuelWidget. The canvas colors are
 * the stat-chip palette (`$chip-*` in `_widget-tokens.scss`), so the chart
 * reads in the same tones as the rows above it.
 */

export const FUEL_COLORS = {
  /** Safe fuel level (enough for the session + buffer) */
  safe: '#19b394',
  /** Warning level (within buffer zone) */
  warning: '#e5b822',
  /** Danger level (short of fuel) */
  danger: '#ef4444',
  /** Neutral/Secondary color (blue) */
  primary: '#3399ff',
  /** Average line color (amber) */
  average: 'rgba(229,184,34,0.8)',
  /** Average label color (amber muted) */
  averageLabel: '#e5b822',
  /** Grid and guide lines */
  grid: 'rgba(255,255,255,0.07)',
  /** Text and labels muted */
  textMuted: '#7e828a',
  /**
   * A lap that happened but does not count — an out-lap, a caution lap, a lap
   * with a trip through the grass. Grey keeps it in the history without letting
   * it read as a consumption the average should have followed.
   */
  rejected: '#52565e',
} as const;

export const FUEL_CHART_CONFIG = {
  /** Height of the X-axis label area in pixels */
  X_LABEL_H: 18,
  /** Horizontal padding for the chart area to prevent label clipping */
  PADDING_H: 10,
  /** Gap between bars in pixels */
  BAR_GAP: 2,
  /** Scale factor applied to min value to add bottom padding in chart */
  MIN_SCALE: 0.88,
  /** Scale factor applied to min value to add bottom padding in line chart */
  MIN_SCALE_LINE: 0.92,
  /** Scale factor applied to max value to add top padding in chart */
  MAX_SCALE: 1.05,
} as const;

// The window bounds are the backend's — it validates `set_fuel_avg_window`
// against them — so they are re-exported from the generated file rather than
// restated here.
export {
  FUEL_AVG_WINDOW_ALL_LAPS,
  FUEL_AVG_WINDOW_MAX,
} from '@shared/contracts/generated/backend-constants';

export const FUEL_THRESHOLDS = {
  /** Additional laps of fuel beyond pitWarningLaps to consider "Safe" */
  LAPS_LEFT_GREEN_BUFFER: 2,
  /**
   * Laps of fuel left at which the pit window has run out of laps to offer and
   * the header stops naming one — the same one-lap cushion the backend takes
   * off the dry-tank lap to get `pitWindowEnd`, which is why it comes from the
   * generated file instead of a number repeated here.
   */
  PIT_NOW_LAPS: PIT_WINDOW_END_BUFFER_LAPS,
} as const;
