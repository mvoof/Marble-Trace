import type { ReferenceLapSample } from '@/types/bindings';

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

/** Pedal travel above which the brake counts as applied — same value the corner scan uses. */
const BRAKE_ON_THRESHOLD = 0.05;

/** A bucket or sample slot carrying no value. */
export const NO_VALUE = Number.NaN;

/**
 * The drawn window as parallel typed arrays rather than an array of points.
 *
 * The window is rebuilt on every telemetry frame, so it must not allocate: the
 * same buffers are refilled in place and the canvas reads them directly. This
 * mirrors how the input trace keeps its ring buffer out of the render path.
 */
export interface TraceWindowBuffers {
  /** Signed distance from the car, in metres. Negative = already driven. */
  offsetM: Float32Array;
  /** Reference-lap speed (m/s), or `NO_VALUE`. */
  referenceSpeed: Float32Array;
  /** This lap's speed (m/s), or `NO_VALUE` ahead of the car / where nothing was recorded. */
  ownSpeed: Float32Array;
  /** Reference-lap brake input (0-1), or `NO_VALUE`. */
  referenceBrake: Float32Array;
  /** This lap's brake input (0-1), or `NO_VALUE`. */
  ownBrake: Float32Array;
  /**
   * Time gained or lost against the reference from the start of the window up
   * to this point, in seconds. Positive = lost time, negative = gained.
   * `NO_VALUE` until both traces have data to compare.
   */
  timeDeltaS: Float32Array;
}

export interface TraceWindowStats {
  /**
   * `timeDeltaS` at the car's current position — how much this pass through the
   * window has cost or gained against the reference. This is what colors the
   * line and what the call row reads out; it is deliberately anchored to the
   * window rather than to the start of the lap, so a single braking zone can be
   * judged on its own instead of being buried under the whole lap's delta.
   */
  windowDeltaS: number | null;
  /** Where the reference driver first got on the brakes inside this window, in metres from the car. */
  referenceBrakeOffsetM: number | null;
  /** Where this lap first got on the brakes inside this window, in metres from the car. */
  ownBrakeOffsetM: number | null;
  /**
   * How much later this lap got on the brakes than the reference, in metres.
   * Positive = braked later. Null unless both braking points are in the window,
   * because there is nothing to be later *than* otherwise.
   */
  brakeDeltaM: number | null;
  /** Whether anything at all was drawn — false leaves the canvas empty. */
  hasData: boolean;
}

export const createTraceWindowBuffers = (): TraceWindowBuffers => ({
  offsetM: new Float32Array(TRACE_POINT_COUNT),
  referenceSpeed: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  ownSpeed: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  referenceBrake: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  ownBrake: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  timeDeltaS: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
});

export const EMPTY_TRACE_STATS: TraceWindowStats = {
  windowDeltaS: null,
  referenceBrakeOffsetM: null,
  ownBrakeOffsetM: null,
  brakeDeltaM: null,
  hasData: false,
};

export interface FillTraceWindowParams {
  referenceSamples: ReferenceLapSample[] | null;
  /** Speed per lap-distance bucket for the lap in progress; `NO_VALUE` where nothing was written. */
  ownSpeedByBucket: Float32Array;
  /** Brake input per lap-distance bucket for the lap in progress; `NO_VALUE` where nothing was written. */
  ownBrakeByBucket: Float32Array;
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

const isValue = (value: number): boolean => !Number.isNaN(value);

/**
 * Nearest-bucket reference lookup. The window is sampled far more densely than
 * the reference is stored, so interpolating between buckets would only smooth a
 * curve the driver cannot act on at that resolution anyway.
 */
const referenceSpeedAt = (
  samples: ReferenceLapSample[] | null,
  pct: number
): number => {
  if (!samples || samples.length === 0) return NO_VALUE;

  return samples[bucketForPct(pct, samples.length)]?.speed ?? NO_VALUE;
};

const referenceBrakeAt = (
  samples: ReferenceLapSample[] | null,
  pct: number
): number => {
  if (!samples || samples.length === 0) return NO_VALUE;

  return samples[bucketForPct(pct, samples.length)]?.brake ?? NO_VALUE;
};

/**
 * Refills `buffers` with the reference lap and the lap in progress across a
 * window centred on the car, accumulating the time delta between them along it.
 *
 * The reference is drawn across the whole window because it is the only source
 * of what lies ahead; the own trace necessarily stops at the car. Both are
 * sampled by distance rather than by time, so the two laps stay comparable no
 * matter how differently they were driven.
 */
export const fillTraceWindow = (
  buffers: TraceWindowBuffers,
  {
    referenceSamples,
    ownSpeedByBucket,
    ownBrakeByBucket,
    currentDistPct,
    trackLengthM,
    windowMeters,
  }: FillTraceWindowParams
): TraceWindowStats => {
  buffers.referenceSpeed.fill(NO_VALUE);
  buffers.ownSpeed.fill(NO_VALUE);
  buffers.referenceBrake.fill(NO_VALUE);
  buffers.ownBrake.fill(NO_VALUE);
  buffers.timeDeltaS.fill(NO_VALUE);

  if (trackLengthM <= 0 || windowMeters <= 0) {
    return EMPTY_TRACE_STATS;
  }

  const step = (windowMeters * 2) / (TRACE_POINT_COUNT - 1);
  const bucketCount = ownSpeedByBucket.length;

  let cumulativeDeltaS = NO_VALUE;
  let previousOwnSpeed = NO_VALUE;
  let previousReferenceSpeed = NO_VALUE;
  let previousReferenceBrake = NO_VALUE;
  let previousOwnBrake = NO_VALUE;
  let referenceBrakeOffsetM: number | null = null;
  let ownBrakeOffsetM: number | null = null;
  let hasData = false;

  for (let index = 0; index < TRACE_POINT_COUNT; index++) {
    const offsetM = -windowMeters + index * step;
    const pct = wrapPct(currentDistPct + offsetM / trackLengthM);

    buffers.offsetM[index] = offsetM;

    const referenceSpeed = referenceSpeedAt(referenceSamples, pct);
    const referenceBrake = referenceBrakeAt(referenceSamples, pct);

    // Nothing ahead of the car has been driven this lap yet, and a bucket the
    // car has not reached still holds the previous lap's value until it is
    // cleared — both must read as absent rather than as a flat line.
    const bucket = bucketForPct(pct, bucketCount);
    const ownSpeed =
      offsetM > 0 ? NO_VALUE : (ownSpeedByBucket[bucket] ?? NO_VALUE);
    const ownBrake =
      offsetM > 0 ? NO_VALUE : (ownBrakeByBucket[bucket] ?? NO_VALUE);

    buffers.referenceSpeed[index] = referenceSpeed;
    buffers.ownSpeed[index] = ownSpeed;
    buffers.referenceBrake[index] = referenceBrake;
    buffers.ownBrake[index] = ownBrake;

    if (isValue(referenceSpeed) || isValue(ownSpeed)) {
      hasData = true;
    }

    // First rising edge only: the braking point is where the pedal went down,
    // not every moment it happened to be held.
    if (
      referenceBrakeOffsetM === null &&
      isValue(previousReferenceBrake) &&
      previousReferenceBrake <= BRAKE_ON_THRESHOLD &&
      referenceBrake > BRAKE_ON_THRESHOLD
    ) {
      referenceBrakeOffsetM = offsetM;
    }

    if (
      ownBrakeOffsetM === null &&
      isValue(previousOwnBrake) &&
      previousOwnBrake <= BRAKE_ON_THRESHOLD &&
      ownBrake > BRAKE_ON_THRESHOLD
    ) {
      ownBrakeOffsetM = offsetM;
    }

    if (
      isValue(previousOwnSpeed) &&
      isValue(previousReferenceSpeed) &&
      isValue(ownSpeed) &&
      isValue(referenceSpeed)
    ) {
      // Trapezoid over the segment: average the endpoint speeds on each trace,
      // then difference the two times.
      const ownSegmentS = secondsFor(step, (previousOwnSpeed + ownSpeed) / 2);
      const referenceSegmentS = secondsFor(
        step,
        (previousReferenceSpeed + referenceSpeed) / 2
      );

      cumulativeDeltaS =
        (isValue(cumulativeDeltaS) ? cumulativeDeltaS : 0) +
        (ownSegmentS - referenceSegmentS);
    }

    if (isValue(ownSpeed)) {
      buffers.timeDeltaS[index] = cumulativeDeltaS;
    }

    previousOwnSpeed = ownSpeed;
    previousReferenceSpeed = referenceSpeed;
    previousReferenceBrake = referenceBrake;
    previousOwnBrake = ownBrake;
  }

  return {
    windowDeltaS: isValue(cumulativeDeltaS) ? cumulativeDeltaS : null,
    referenceBrakeOffsetM,
    ownBrakeOffsetM,
    brakeDeltaM:
      referenceBrakeOffsetM !== null && ownBrakeOffsetM !== null
        ? ownBrakeOffsetM - referenceBrakeOffsetM
        : null,
    hasData,
  };
};

/** Lowest and highest value drawn in the window, for the vertical scale. */
export const traceValueRange = (
  reference: Float32Array,
  own: Float32Array
): { min: number; max: number } | null => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < TRACE_POINT_COUNT; index++) {
    const referenceValue = reference[index] ?? NO_VALUE;
    const ownValue = own[index] ?? NO_VALUE;

    if (isValue(referenceValue)) {
      min = Math.min(min, referenceValue);
      max = Math.max(max, referenceValue);
    }

    if (isValue(ownValue)) {
      min = Math.min(min, ownValue);
      max = Math.max(max, ownValue);
    }
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
};
