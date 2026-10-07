/**
 * What both radar widgets share: the pill colour the bar paints, and the scale
 * the round scope is drawn at.
 *
 * The scale lives here rather than beside the scope because the **store** needs
 * it too — the proximity radar activates on the range it draws, so deciding
 * whether a car is in the scope is the same arithmetic as placing it there. A
 * store reaching into `@ui/**` is a lint error, so the shared half sits in
 * `utils/`.
 */

import type { LateralSide } from '@/types/bindings';
import type { RadarScaleMode } from '@/types/widget-settings';

/** Proximity center distance considered dangerous for RadarBar */
const BAR_DANGER_DISTANCE = 1.0;
/** Proximity center distance considered warning for RadarBar */
const BAR_WARNING_DISTANCE = 2.5;

const RADAR_COLORS = {
  /** Collision imminent */
  danger: '#ff2a55',
  /** Close proximity */
  warning: '#eab308',
  /** Safe distance */
  safe: '#22c55e',
} as const;

/**
 * Solid (no alpha) color for RadarBar pill based on center distance.
 */
export const getBarPillColor = (centerDistance: number): string => {
  if (centerDistance <= BAR_DANGER_DISTANCE) return RADAR_COLORS.danger;
  if (centerDistance <= BAR_WARNING_DISTANCE) return RADAR_COLORS.warning;

  return RADAR_COLORS.safe;
};

/** 180 px of widget covers a 10 m radius. */
export const DESIGN_SIZE_PX = 180;
export const DESIGN_SCOPE_RANGE_M = 10;

/**
 * How far to the side an alongside car is drawn. The sim never reports a
 * lateral position, so this is a constant, not a measurement — wide enough that
 * the beam tracking a side car clears the player's own body.
 */
export const SIDE_LATERAL_OFFSET_M = 3.4;

interface ScaleInput {
  scaleMode: RadarScaleMode;
  scopeRange: number;
  /** Half of the widget's rendered side, in CSS pixels. */
  radiusPx: number;
  widgetScale: number;
}

export interface ScopeScale {
  pxPerMeter: number;
  /** Meters the circle actually covers, whichever mode produced them. */
  rangeMeters: number;
}

/**
 * One knob decides both the zoom and what fits in the circle, and the user
 * picks which one it is.
 */
export const resolveScopeScale = ({
  scaleMode,
  scopeRange,
  radiusPx,
  widgetScale,
}: ScaleInput): ScopeScale => {
  const designPxPerMeter = DESIGN_SIZE_PX / 2 / DESIGN_SCOPE_RANGE_M;

  if (scaleMode === 'fixed-cars') {
    return {
      pxPerMeter: designPxPerMeter,
      rangeMeters: radiusPx / designPxPerMeter,
    };
  }

  if (scaleMode === 'manual') {
    // A hand-edited file can carry a zero or a negative here, and a scope of
    // zero meters is an infinite pxPerMeter — every car drawn as a full-screen
    // block. Fall back to the design range instead.
    const range =
      Number.isFinite(scopeRange) && scopeRange > 0
        ? scopeRange
        : DESIGN_SCOPE_RANGE_M;

    return { pxPerMeter: radiusPx / range, rangeMeters: range };
  }

  const pxPerMeter = designPxPerMeter * widgetScale;

  return { pxPerMeter, rangeMeters: radiusPx / pxPerMeter };
};

/**
 * Where a car sits from the middle of the scope, in meters. A car alongside is
 * drawn at a fixed lateral offset, so its distance is the hypotenuse — the same
 * number the scope tests a row against before it draws it. Activation and
 * drawing therefore agree by construction: what wakes the widget is exactly
 * what it can show.
 */
export const scopeDistanceOf = (car: {
  longitudinalDist: number;
  lateralSide: LateralSide;
}): number => {
  if (car.lateralSide === 'center') {
    return Math.abs(car.longitudinalDist);
  }

  return Math.hypot(SIDE_LATERAL_OFFSET_M, car.longitudinalDist);
};
