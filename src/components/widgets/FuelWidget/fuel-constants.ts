/**
 * Shared constants and thresholds for the FuelWidget.
 */

export const FUEL_COLORS = {
  /** Safe fuel level (enough for the session + buffer) */
  safe: '#22c55e',
  /** Warning level (within buffer zone) */
  warning: '#f59e0b',
  /** Danger level (short of fuel) */
  danger: '#ef4444',
  /** Neutral/Secondary color (blue) */
  primary: '#3399ff',
  /** Average line color (amber) */
  average: 'rgba(251,191,36,0.9)',
  /** Average label color (amber muted) */
  averageLabel: 'rgba(251,191,36,0.8)',
  /** Grid and guide lines */
  grid: 'rgba(255,255,255,0.07)',
  /** Text and labels muted */
  textMuted: 'rgba(255,255,255,0.55)',
} as const;

export const FUEL_CHART_CONFIG = {
  /** Maximum number of lap history entries to show in the chart */
  MAX_VISIBLE: 30,
  /** Width of the Y-axis label area in pixels */
  Y_LABEL_W: 36,
  /** Height of the X-axis label area in pixels */
  X_LABEL_H: 18,
  /** Number of grid lines to draw */
  GRID_COUNT: 4,
  /** Width of bars in the bar chart in pixels */
  BAR_WIDTH: 5,
  /** Gap between bars in pixels */
  BAR_GAP: 2,
  /** Approximate width of a single character in the font in pixels */
  LABEL_CHAR_W: 7,
  /** Minimum gap between X-axis labels in pixels */
  LABEL_MIN_GAP: 2,
} as const;

export const FUEL_THRESHOLDS = {
  /** Additional laps of fuel beyond pitWarningLaps to consider "Safe" */
  LAPS_LEFT_GREEN_BUFFER: 2,
} as const;
