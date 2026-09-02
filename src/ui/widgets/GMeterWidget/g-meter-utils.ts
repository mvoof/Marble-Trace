import type { GMeterColorMode } from '@/types/widget-settings';

export const G_CONSTANT = 9.81;
export const SMOOTHING = 0.12;
export const TRACE_LENGTH = 100;
export const FADING_DECAY = 0.9992;
export const ENVELOPE_SPREAD = 10;
export const RADIUS_RATIO = 0.76;

/** The axes run a little past the outer ring, so the cross reads as a cross. */
export const AXIS_OVERHANG = 1.06;

/**
 * Ring numbers sit on the 45° diagonal of the upper-right quadrant instead of
 * on an axis: the axes are the busiest part of the circle, and the diagonal is
 * the one direction a trace crosses least.
 */
export const RING_LABEL_ANGLE = -Math.PI / 4;

/** Clearance either side of a ring number, in px, before the ring resumes. */
export const RING_LABEL_GAP_PX = 5;

/** Where the pair of values sits along its quadrant's diagonal. */
export const QUADRANT_VALUE_RADIUS_RATIO = 0.6;

/** The four outer arcs, out past the last ring. */
export const OUTER_ARC_RADIUS_RATIO = 1.16;
export const OUTER_ARC_HALF_SWEEP = Math.PI / 6;
export const OUTER_ARC_CENTERS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

/**
 * How far the load has run past the outer ring, 0…1 over one more G. The dot is
 * clamped to the ring, so without this the widget would look identical at the
 * limit and well beyond it — the arcs are what says the scale is too small.
 */
export const computeOverload = (dist: number, scale: number): number => {
  if (dist <= scale) return 0;

  return Math.min(1, dist - scale);
};

/**
 * The quadrant the load points into, as the direction its diagonal runs in.
 * Canvas y grows downward, so a positive `lonG` (acceleration) is up.
 */
export const quadrantDiagonal = (
  latG: number,
  lonG: number
): { dx: number; dy: number } => ({
  dx: latG >= 0 ? Math.SQRT1_2 : -Math.SQRT1_2,
  dy: lonG >= 0 ? -Math.SQRT1_2 : Math.SQRT1_2,
});

export const COLOR_TURN = '#3b82f6';
const COLOR_BRAKE = '#ef4444';
const COLOR_ACCEL = '#10b981';
const COLOR_IDLE = '#9ca3af';

/** The over-range arcs — always red, whatever the color mode. */
export const COLOR_OVERLOAD = '#ef4444';

export const computeColor = (
  colorMode: GMeterColorMode,
  latG: number,
  lonG: number,
  dist: number
): string => {
  if (colorMode === 'mono') return COLOR_TURN;

  if (colorMode === 'simple') {
    if (lonG < -0.15) return COLOR_BRAKE;
    if (lonG > 0.15) return COLOR_ACCEL;

    return COLOR_TURN;
  }

  if (dist < 0.1) return COLOR_IDLE;

  const angle = Math.atan2(Math.abs(lonG), Math.abs(latG));
  const wLon = Math.sqrt(angle / (Math.PI / 2));
  const wTurn = 1.0 - wLon;

  if (lonG < 0) {
    // brake (#ef4444 = 239,68,68) → turn (#3b82f6 = 59,130,246)
    const r = Math.round(239 * wLon + 59 * wTurn);
    const g = Math.round(68 * wLon + 130 * wTurn);
    const b = Math.round(68 * wLon + 246 * wTurn);

    return `rgb(${r},${g},${b})`;
  } else {
    // accel (#10b981 = 16,185,129) → turn (#3b82f6 = 59,130,246)
    const r = Math.round(16 * wLon + 59 * wTurn);
    const g = Math.round(185 * wLon + 130 * wTurn);
    const b = Math.round(129 * wLon + 246 * wTurn);

    return `rgb(${r},${g},${b})`;
  }
};
