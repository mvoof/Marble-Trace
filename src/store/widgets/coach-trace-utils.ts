import type { ReferenceLapSample } from '@/types/bindings';
import { interpolateReferenceSample } from './driving-coach-utils';

/**
 * Number of points sampled across the whole window. Odd so one point lands
 * exactly on the car's current position — that point is the trace's endpoint
 * and the anchor for the "now" marker.
 */
export const TRACE_POINT_COUNT = 121;

/**
 * Speeds below this (m/s) are treated as this value when converting speed to
 * time. Time per metre is 1/v, which diverges as the car stops; a standing car
 * would otherwise contribute an unbounded delta for a segment it has not
 * actually driven yet.
 */
const MIN_SPEED_FOR_TIME_MPS = 1;

/** A recorded own-lap bucket that was never written carries this instead of a speed. */
export const UNRECORDED_SPEED = Number.NaN;

export interface TracePoint {
  /** Signed distance from the car, in metres. Negative = already driven. */
  offsetM: number;
  /** Reference-lap speed here (m/s), or null when no reference is loaded. */
  referenceSpeed: number | null;
  /** This lap's speed here (m/s), or null ahead of the car / where nothing was recorded. */
  ownSpeed: number | null;
  /**
   * Time gained or lost against the reference from the start of the window up
   * to this point, in seconds. Positive = lost time (slower than reference),
   * negative = gained. Null until both traces have data to compare.
   */
  timeDeltaS: number | null;
}

export interface TraceWindow {
  points: TracePoint[];
  /**
   * `timeDeltaS` at the car's current position — how much this pass through the
   * window has cost or gained against the reference. This is what colors the
   * line and what the header reads out; it is deliberately anchored to the
   * window rather than to the start of the lap, so a single braking zone can
   * be judged on its own instead of being buried under the whole lap's delta.
   */
  windowDeltaS: number | null;
}

export interface BuildTraceWindowParams {
  referenceSamples: ReferenceLapSample[] | null;
  /** Speed per lap-distance bucket for the lap in progress; `UNRECORDED_SPEED` where nothing was written. */
  ownSpeedByBucket: Float32Array;
  currentDistPct: number;
  trackLengthM: number;
  /** Half-width of the window: the trace spans `-windowMeters .. +windowMeters`. */
  windowMeters: number;
}

const wrapPct = (pct: number): number => ((pct % 1) + 1) % 1;

const bucketForPct = (pct: number, bucketCount: number): number =>
  Math.min(Math.floor(wrapPct(pct) * bucketCount), bucketCount - 1);

/** Seconds to cover `distanceM` at `speedMps`, floored so a stopped car cannot diverge. */
const secondsFor = (distanceM: number, speedMps: number): number =>
  distanceM / Math.max(speedMps, MIN_SPEED_FOR_TIME_MPS);

/**
 * Samples the reference lap and the lap in progress across a window centred on
 * the car, and accumulates the time delta between them along it.
 *
 * The reference is drawn across the whole window because it is the only source
 * of what lies ahead; the own trace necessarily stops at the car. Both are
 * sampled by distance rather than by time, so the two laps stay comparable no
 * matter how differently they were driven.
 */
export const buildTraceWindow = ({
  referenceSamples,
  ownSpeedByBucket,
  currentDistPct,
  trackLengthM,
  windowMeters,
}: BuildTraceWindowParams): TraceWindow => {
  const points: TracePoint[] = [];

  if (trackLengthM <= 0 || windowMeters <= 0) {
    return { points, windowDeltaS: null };
  }

  const step = (windowMeters * 2) / (TRACE_POINT_COUNT - 1);
  const bucketCount = ownSpeedByBucket.length;

  let cumulativeDeltaS: number | null = null;
  let previousOwnSpeed: number | null = null;
  let previousReferenceSpeed: number | null = null;

  for (let index = 0; index < TRACE_POINT_COUNT; index++) {
    const offsetM = -windowMeters + index * step;
    const pct = wrapPct(currentDistPct + offsetM / trackLengthM);

    const referenceSpeed = referenceSamples
      ? (interpolateReferenceSample(referenceSamples, pct)?.speed ?? null)
      : null;

    // Nothing ahead of the car has been driven this lap yet, and a bucket the
    // car has not reached still holds the previous lap's value until it is
    // cleared — both must read as absent rather than as a flat line.
    const rawOwnSpeed =
      offsetM > 0
        ? UNRECORDED_SPEED
        : ownSpeedByBucket[bucketForPct(pct, bucketCount)];
    const ownSpeed =
      rawOwnSpeed === undefined || Number.isNaN(rawOwnSpeed)
        ? null
        : rawOwnSpeed;

    if (
      previousOwnSpeed !== null &&
      previousReferenceSpeed !== null &&
      ownSpeed !== null &&
      referenceSpeed !== null
    ) {
      // Trapezoid over the segment: average the endpoint speeds on each trace,
      // then difference the two times. Sampling the midpoint instead would
      // read the same bucket twice at this resolution.
      const ownSegmentS = secondsFor(step, (previousOwnSpeed + ownSpeed) / 2);
      const referenceSegmentS = secondsFor(
        step,
        (previousReferenceSpeed + referenceSpeed) / 2
      );

      cumulativeDeltaS =
        (cumulativeDeltaS ?? 0) + (ownSegmentS - referenceSegmentS);
    }

    points.push({
      offsetM,
      referenceSpeed,
      ownSpeed,
      timeDeltaS: ownSpeed === null ? null : cumulativeDeltaS,
    });

    previousOwnSpeed = ownSpeed;
    previousReferenceSpeed = referenceSpeed;
  }

  return { points, windowDeltaS: cumulativeDeltaS };
};

/** Lowest and highest speed drawn in the window, for the vertical scale. */
export const traceSpeedRange = (
  points: TracePoint[]
): { min: number; max: number } | null => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    for (const speed of [point.referenceSpeed, point.ownSpeed]) {
      if (speed === null) continue;

      min = Math.min(min, speed);
      max = Math.max(max, speed);
    }
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
};
