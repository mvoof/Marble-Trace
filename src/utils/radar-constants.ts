/**
 * Shared constants and utilities for radar widgets
 * (ProximityRadarWidget & RadarBarWidget).
 */

// === Car physical dimensions (meters) ===

/** Average car body width */
export const CAR_WIDTH = 1.8;

/** Average car body length */
export const CAR_LENGTH = 4.4;

/** Corner radius for car icon rendering */
export const CAR_CORNER_RADIUS = 0.2;

/** Lateral offset for side car positioning (car width + gap) */
export const SIDE_CAR_LATERAL_OFFSET = CAR_WIDTH + 0.6;

// === Danger zone colors (hex base) ===

export const RADAR_COLORS = {
  /** Collision imminent */
  danger: '#ff2a55',
  /** Close proximity */
  warning: '#eab308',
  /** Safe distance */
  safe: '#22c55e',
  /** Grid/guide lines */
  grid: 'rgba(255, 255, 255, 0.1)',
} as const;

/**
 * Apply alpha transparency to a radar color.
 * Converts hex to rgba string.
 */
export const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// === Distance-to-color mapping ===

/**
 * Color for front/rear cars based on bumper-to-bumper gap.
 * - danger: <= 1m
 * - warning: <= 2m
 * - safe: > 2m
 */
export const getCarColor = (gapMeters: number): string => {
  if (gapMeters <= 1.0) return withAlpha(RADAR_COLORS.danger, 0.7);
  if (gapMeters <= 2.0) return withAlpha(RADAR_COLORS.warning, 0.7);

  return withAlpha(RADAR_COLORS.safe, 0.7);
};

/**
 * Color for side cars (spotter) based on longitudinal overlap.
 * Tighter thresholds since side contact is more dangerous.
 * - danger: <= 0.5m
 * - warning: <= 1.5m
 * - safe: > 1.5m
 */
export const getSideCarColor = (longitudinalOffset: number): string => {
  const abs = Math.abs(longitudinalOffset);

  if (abs <= 0.5) return withAlpha(RADAR_COLORS.danger, 0.7);
  if (abs <= 1.5) return withAlpha(RADAR_COLORS.warning, 0.7);

  return withAlpha(RADAR_COLORS.safe, 0.7);
};

/**
 * Solid (no alpha) color for RadarBar pill based on center distance.
 * - danger: <= 1m
 * - warning: <= 2.5m
 * - safe: > 2.5m
 */
export const getBarPillColor = (centerDistance: number): string => {
  if (centerDistance <= 1.0) return RADAR_COLORS.danger;
  if (centerDistance <= 2.5) return RADAR_COLORS.warning;

  return RADAR_COLORS.safe;
};
