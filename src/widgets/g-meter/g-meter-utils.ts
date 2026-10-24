import type { GMeterColorMode } from './settings-schema';

export const G_CONSTANT = 9.81;

/**
 * The meter's three rates were tuned per frame at the sim's 60 Hz. The overlay
 * now draws on its own clock (30 Hz by default, ADR-0009), so each is applied
 * over the time that actually passed — at any clock the dot lags, the envelope
 * fades and the trail reaches back exactly as they did at 60 Hz.
 */
const TUNED_FRAME_MS = 1000 / 60;

/** Share of the gap to the raw reading the dot closes per 60 Hz tick. */
const SMOOTHING = 0.12;

/** How far back the trail reaches: the hundred points it held at 60 Hz. */
export const TRACE_DURATION_MS = (100 * 1000) / 60;

/** What the fading envelope keeps of itself per 60 Hz tick. */
const FADING_DECAY = 0.9992;

/**
 * The longest gap counted as time passing. A longer one — a paused replay, a
 * stream that stalled — counts as this much, so the meter resumes rather than
 * jumping straight to the new reading and wiping the fading envelope.
 */
const MAX_FRAME_GAP_MS = 250;

/** 60 Hz ticks' worth of time between two frames, `elapsedMs` apart. */
export const ticksElapsed = (elapsedMs: number): number =>
  Math.min(Math.max(elapsedMs, 0), MAX_FRAME_GAP_MS) / TUNED_FRAME_MS;

/** The share of the gap the dot closes over `ticks` ticks. */
export const smoothingOver = (ticks: number): number =>
  1 - (1 - SMOOTHING) ** ticks;

/** What the fading envelope keeps of itself over `ticks` ticks. */
export const decayOver = (ticks: number): number => FADING_DECAY ** ticks;

export const ENVELOPE_SPREAD = 10;
export const RADIUS_RATIO = 0.78;

/**
 * Width of the rim track, in px. The track itself is CSS (`.root::before` in
 * `GMeterWidget.module.scss`, the same number); the axis readings paint over
 * it on the canvas, so the two must stay equal.
 */
export const RIM_WIDTH_PX = 3;

/** The radius the rim track runs along, through the middle of its width. */
export const rimRadiusOf = (width: number, height: number): number =>
  Math.min(width, height) / 2 - RIM_WIDTH_PX / 2;

// The grid is a reference, not a reading: faint dashed hairlines like the
// radar scope's, so the trace and the rim paint are what the eye lands on.
export const GRID_RING_COLOR = 'rgba(250,250,250,0.1)';
export const GRID_AXIS_COLOR = 'rgba(250,250,250,0.08)';
export const GRID_LABEL_COLOR = 'rgba(250,250,250,0.4)';
export const GRID_LINE_WIDTH_PX = 0.75;
export const GRID_DASH_PX = [2, 4];

/**
 * Ring numbers sit on the 45° diagonal of the upper-right quadrant instead of
 * on an axis: the axes are the busiest part of the circle, and the diagonal is
 * the one direction a trace crosses least.
 */
export const RING_LABEL_ANGLE = -Math.PI / 4;

/** Clearance either side of a ring number, in px, before the ring resumes. */
export const RING_LABEL_GAP_PX = 5;

export const COLOR_TURN = '#3b82f6';
const COLOR_BRAKE = '#ef4444';
const COLOR_ACCEL = '#10b981';
const COLOR_IDLE = '#9ca3af';

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
