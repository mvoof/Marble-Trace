import type {
  CoachFrame,
  LapTimingFrame,
  ReferenceLapSample,
} from '@shared/contracts/generated/bindings';

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

/** Throttle above which the car is back on the power — the telemetry thread's `EXIT_THROTTLE_OPEN`. */
const THROTTLE_OPEN_THRESHOLD = 0.2;

/** Throttle at which the exit is over — the telemetry thread's `GAS_THROTTLE_THRESHOLD`. */
const FULL_THROTTLE_THRESHOLD = 0.95;

/**
 * How far (m/s) the speed has to climb back past its lowest point before that
 * point counts as the apex. Until then the car may still be slowing, and the
 * lowest point seen so far is only the latest one.
 */
const APEX_SPEED_RISE_MPS = 0.5;

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
  /** Reference-lap throttle input (0-1), or `NO_VALUE`. */
  referenceThrottle: Float32Array;
  /** This lap's throttle input (0-1), or `NO_VALUE`. */
  ownThrottle: Float32Array;
  /**
   * Time gained or lost against the reference from the start of the window up
   * to this point, in seconds. Positive = lost time, negative = gained.
   * `NO_VALUE` until both traces have data to compare.
   */
  timeDeltaS: Float32Array;
}

/**
 * One lap's way through the first corner in the window, in metres from the
 * car: on the brakes, off them and through the apex, back on the power. A
 * point the lap has not reached — or that lies outside the window — is null.
 */
export interface CornerPhases {
  /**
   * Where the braking zone starts as drawn: the braking point, or the window's
   * left edge when the brake is already down there.
   */
  brakeZoneStartM: number | null;
  /** Where the pedal went down. Null when that happened before the window. */
  brakePointM: number | null;
  /** Where the brake came off again. */
  brakeReleaseM: number | null;
  /** Lowest speed between the braking point and full throttle. */
  apexM: number | null;
  /** Where the throttle opened past `THROTTLE_OPEN_THRESHOLD` after the brake came off. */
  throttlePointM: number | null;
  /** Where the throttle reached `FULL_THROTTLE_THRESHOLD` — the end of the exit. */
  fullThrottleM: number | null;
}

export interface TraceWindowStats {
  /**
   * `timeDeltaS` at the car's current position — how much this pass through the
   * window has cost or gained against the reference. This is what colors the
   * line; it is deliberately anchored to the window rather than to the start of
   * the lap, so a single braking zone can be judged on its own instead of
   * being buried under the whole lap's delta.
   */
  windowDeltaS: number | null;
  /** The reference lap's corner phases — the zones the chart is shaded by. */
  reference: CornerPhases;
  /** This lap's corner phases, as far as the car has driven. */
  own: CornerPhases;
  /**
   * How much later this lap got on the brakes than the reference, in metres.
   * Positive = braked later. Null unless both braking points are in the window,
   * because there is nothing to be later *than* otherwise.
   */
  brakeDeltaM: number | null;
  /** How much later this lap reached its lowest speed than the reference, in metres. */
  apexDeltaM: number | null;
  /** How much later this lap opened the throttle than the reference, in metres. */
  throttleDeltaM: number | null;
  /** Whether anything at all was drawn — false leaves the canvas empty. */
  hasData: boolean;
}

export const createTraceWindowBuffers = (): TraceWindowBuffers => ({
  offsetM: new Float32Array(TRACE_POINT_COUNT),
  referenceSpeed: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  ownSpeed: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  referenceBrake: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  ownBrake: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  referenceThrottle: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  ownThrottle: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
  timeDeltaS: new Float32Array(TRACE_POINT_COUNT).fill(NO_VALUE),
});

export const NO_CORNER_PHASES: CornerPhases = {
  brakeZoneStartM: null,
  brakePointM: null,
  brakeReleaseM: null,
  apexM: null,
  throttlePointM: null,
  fullThrottleM: null,
};

export const EMPTY_TRACE_STATS: TraceWindowStats = {
  windowDeltaS: null,
  reference: NO_CORNER_PHASES,
  own: NO_CORNER_PHASES,
  brakeDeltaM: null,
  apexDeltaM: null,
  throttleDeltaM: null,
  hasData: false,
};

export interface FillTraceWindowParams {
  referenceSamples: ReferenceLapSample[] | null;
  /** Speed per lap-distance bucket for the lap in progress; `NO_VALUE` where nothing was written. */
  ownSpeedByBucket: Float32Array;
  /** Brake input per lap-distance bucket for the lap in progress; `NO_VALUE` where nothing was written. */
  ownBrakeByBucket: Float32Array;
  /** Throttle input per lap-distance bucket for the lap in progress; `NO_VALUE` where nothing was written. */
  ownThrottleByBucket: Float32Array;
  currentDistPct: number;
  trackLengthM: number;
  /** Half-width of the window: the trace spans `-windowMeters .. +windowMeters`. */
  windowMeters: number;
}

const wrapPct = (pct: number): number => ((pct % 1) + 1) % 1;

/** Seconds to cover `distanceM` at `speedMps`, floored so a stopped car cannot diverge. */
const secondsFor = (distanceM: number, speedMps: number): number =>
  distanceM / Math.max(speedMps, MIN_SPEED_FOR_TIME_MPS);

const isValue = (value: number): boolean => !Number.isNaN(value);

/**
 * Where `pct` falls between two bucket centres. A bucket holds the value for
 * the interval `[i/N, (i+1)/N)`, so its value sits at `(i + 0.5)/N`.
 *
 * The window is sampled far more densely than the buckets are stored — 2.5 m a
 * point on the default window against trackLength/1000 a bucket, 20 m on the
 * Nordschleife — so a nearest-bucket lookup holds one value across up to eight
 * points and draws the traces as a staircase. Both traces are read along the
 * line between the two centres instead.
 *
 * Written into a module-level slot rather than returned: the window is refilled
 * on every telemetry frame and must not allocate.
 */
const bucketSpan = { lower: 0, upper: 0, weight: 0 };

const locateBetweenBuckets = (pct: number, bucketCount: number) => {
  const position = wrapPct(pct) * bucketCount - 0.5;
  const lowerIndex = Math.floor(position);

  bucketSpan.lower = (lowerIndex + bucketCount) % bucketCount;
  bucketSpan.upper = (lowerIndex + 1) % bucketCount;
  bucketSpan.weight = position - lowerIndex;
};

/**
 * The line between two neighbouring buckets; where one of them holds nothing —
 * the edge of what this lap has driven, a gap in a reference — the other alone.
 */
const blendBuckets = (lower: number, upper: number): number => {
  if (!isValue(lower)) return upper;

  if (!isValue(upper)) return lower;

  return lower + (upper - lower) * bucketSpan.weight;
};

const bucketValueAt = (values: Float32Array, pct: number): number => {
  locateBetweenBuckets(pct, values.length);

  return blendBuckets(
    values[bucketSpan.lower] ?? NO_VALUE,
    values[bucketSpan.upper] ?? NO_VALUE
  );
};

const referenceValueAt = (
  samples: ReferenceLapSample[] | null,
  field: 'speed' | 'brake' | 'throttle',
  pct: number
): number => {
  if (!samples || samples.length === 0) return NO_VALUE;

  locateBetweenBuckets(pct, samples.length);

  return blendBuckets(
    samples[bucketSpan.lower]?.[field] ?? NO_VALUE,
    samples[bucketSpan.upper]?.[field] ?? NO_VALUE
  );
};

/** First index at or after `from` where `matches` holds, stopping at the first gap in `values`. */
const findIndex = (
  values: Float32Array,
  from: number,
  matches: (value: number, index: number) => boolean
): number | null => {
  for (let index = from; index < TRACE_POINT_COUNT; index++) {
    const value = values[index] ?? NO_VALUE;

    if (!isValue(value)) return null;

    if (matches(value, index)) return index;
  }

  return null;
};

/** Last index from `from` on before the first gap — how far this trace reaches. */
const lastValueIndex = (values: Float32Array, from: number): number => {
  let last = from;

  for (let index = from; index < TRACE_POINT_COUNT; index++) {
    if (!isValue(values[index] ?? NO_VALUE)) break;

    last = index;
  }

  return last;
};

/**
 * Lowest speed in `[from, to]`, once the speed has climbed back far enough past
 * it to be sure it is the lowest; null while the car could still be slowing.
 */
const findApex = (
  speed: Float32Array,
  from: number,
  to: number
): number | null => {
  let lowestIndex = from;
  let lowest = speed[from] ?? NO_VALUE;
  let highestAfterLowest = lowest;

  for (let index = from + 1; index <= to; index++) {
    const value = speed[index] ?? NO_VALUE;

    if (!isValue(value)) break;

    if (value < lowest) {
      lowest = value;
      lowestIndex = index;
      highestAfterLowest = value;
    } else {
      highestAfterLowest = Math.max(highestAfterLowest, value);
    }
  }

  return highestAfterLowest - lowest >= APEX_SPEED_RISE_MPS
    ? lowestIndex
    : null;
};

/**
 * The first corner in the window, split into the phases a driver works through:
 * the brake goes down, comes off, the speed bottoms out, the throttle opens and
 * reaches full. Each phase is searched for only after the one before it, so a
 * lift on the straight is not taken for a throttle point and the next corner's
 * braking is not taken for this one's.
 */
const findCornerPhases = (
  offsetM: Float32Array,
  speed: Float32Array,
  brake: Float32Array,
  throttle: Float32Array
): CornerPhases => {
  // A lap that has only just started has nothing behind the car yet.
  const firstValue = brake.findIndex((value) => isValue(value));

  if (firstValue === -1) return NO_CORNER_PHASES;

  const zoneStart = findIndex(
    brake,
    firstValue,
    (value) => value > BRAKE_ON_THRESHOLD
  );

  if (zoneStart === null) return NO_CORNER_PHASES;

  // The braking point is a rising edge: the pedal already down where the trace
  // begins went down somewhere this window does not show.
  const hasBrakePoint = zoneStart > firstValue;

  const release = findIndex(
    brake,
    zoneStart,
    (value) => value <= BRAKE_ON_THRESHOLD
  );
  const throttlePoint =
    release === null
      ? null
      : findIndex(
          throttle,
          release,
          (value, index) =>
            value > THROTTLE_OPEN_THRESHOLD &&
            (brake[index] ?? 0) <= BRAKE_ON_THRESHOLD
        );
  const fullThrottle =
    throttlePoint === null
      ? null
      : findIndex(
          throttle,
          throttlePoint,
          (value, index) =>
            value >= FULL_THROTTLE_THRESHOLD ||
            (brake[index] ?? 0) > BRAKE_ON_THRESHOLD
        );
  const apex = findApex(
    speed,
    zoneStart,
    fullThrottle ?? lastValueIndex(speed, zoneStart)
  );

  const offsetAt = (index: number | null): number | null =>
    index === null ? null : (offsetM[index] ?? null);

  return {
    brakeZoneStartM: offsetAt(zoneStart),
    brakePointM: hasBrakePoint ? offsetAt(zoneStart) : null,
    brakeReleaseM: offsetAt(release),
    apexM: offsetAt(apex),
    throttlePointM: offsetAt(throttlePoint),
    fullThrottleM: offsetAt(fullThrottle),
  };
};

const laterBy = (own: number | null, reference: number | null) =>
  own !== null && reference !== null ? own - reference : null;

/**
 * What one phase figure in the header says:
 * - `to-go` — the reference's point is still ahead and this lap has not got
 *   there yet: metres left to it;
 * - `overshoot` — the reference's point is behind and this lap still has not
 *   done it: metres run past it so far, growing;
 * - `miss` — this lap has done it: metres later (+) or earlier (−) than the
 *   reference, settled.
 */
export type PhaseFigureKind = 'to-go' | 'overshoot' | 'miss';

export interface PhaseFigure {
  kind: PhaseFigureKind;
  /** Metres; signed only for `miss`. */
  valueM: number;
}

/**
 * The header figure for one phase, from where the reference did it and where
 * this lap did, both in metres from the car. Null when the reference's point
 * is not in the window — there is nothing to measure against.
 */
export const phaseFigure = (
  referenceM: number | null,
  ownM: number | null
): PhaseFigure | null => {
  if (referenceM === null) {
    return null;
  }

  if (ownM !== null) {
    return { kind: 'miss', valueM: ownM - referenceM };
  }

  if (referenceM > 0) {
    return { kind: 'to-go', valueM: referenceM };
  }

  return { kind: 'overshoot', valueM: -referenceM };
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
    ownThrottleByBucket,
    currentDistPct,
    trackLengthM,
    windowMeters,
  }: FillTraceWindowParams
): TraceWindowStats => {
  buffers.referenceSpeed.fill(NO_VALUE);
  buffers.ownSpeed.fill(NO_VALUE);
  buffers.referenceBrake.fill(NO_VALUE);
  buffers.ownBrake.fill(NO_VALUE);
  buffers.referenceThrottle.fill(NO_VALUE);
  buffers.ownThrottle.fill(NO_VALUE);
  buffers.timeDeltaS.fill(NO_VALUE);

  if (trackLengthM <= 0 || windowMeters <= 0) {
    return EMPTY_TRACE_STATS;
  }

  const step = (windowMeters * 2) / (TRACE_POINT_COUNT - 1);

  let cumulativeDeltaS = NO_VALUE;
  let previousOwnSpeed = NO_VALUE;
  let previousReferenceSpeed = NO_VALUE;
  let hasData = false;

  for (let index = 0; index < TRACE_POINT_COUNT; index++) {
    const offsetM = -windowMeters + index * step;
    const pct = wrapPct(currentDistPct + offsetM / trackLengthM);

    buffers.offsetM[index] = offsetM;

    const referenceSpeed = referenceValueAt(referenceSamples, 'speed', pct);

    // Nothing ahead of the car has been driven this lap yet, and a bucket the
    // car has not reached still holds the previous lap's value until it is
    // cleared — both must read as absent rather than as a flat line.
    const driven = offsetM <= 0;
    const ownSpeed = driven ? bucketValueAt(ownSpeedByBucket, pct) : NO_VALUE;

    buffers.referenceSpeed[index] = referenceSpeed;
    buffers.ownSpeed[index] = ownSpeed;
    buffers.referenceBrake[index] = referenceValueAt(
      referenceSamples,
      'brake',
      pct
    );
    buffers.ownBrake[index] = driven
      ? bucketValueAt(ownBrakeByBucket, pct)
      : NO_VALUE;
    buffers.referenceThrottle[index] = referenceValueAt(
      referenceSamples,
      'throttle',
      pct
    );
    buffers.ownThrottle[index] = driven
      ? bucketValueAt(ownThrottleByBucket, pct)
      : NO_VALUE;

    if (isValue(referenceSpeed) || isValue(ownSpeed)) {
      hasData = true;
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
  }

  const reference = findCornerPhases(
    buffers.offsetM,
    buffers.referenceSpeed,
    buffers.referenceBrake,
    buffers.referenceThrottle
  );
  const own = findCornerPhases(
    buffers.offsetM,
    buffers.ownSpeed,
    buffers.ownBrake,
    buffers.ownThrottle
  );

  return {
    windowDeltaS: isValue(cumulativeDeltaS) ? cumulativeDeltaS : null,
    reference,
    own,
    brakeDeltaM: laterBy(own.brakePointM, reference.brakePointM),
    apexDeltaM: laterBy(own.apexM, reference.apexM),
    throttleDeltaM: laterBy(own.throttlePointM, reference.throttlePointM),
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

/**
 * Linearly interpolated reference sample at `lapDistPct`, wrapping across the
 * lap boundary — for the readouts beside the call; the call itself is the
 * telemetry thread's (`mt-computations/src/driving/coach.rs`, which interpolates the same way). Buckets store the value for the *interval* `[i/N, (i+1)/N)`,
 * so each bucket's value is treated as located at the interval center
 * `(i + 0.5)/N`; the continuous position between two centers is
 *
 *   x = lapDistPct * N - 0.5,   t = frac(x)
 *   value = sample[floor(x)] * (1 - t) + sample[floor(x) + 1] * t
 *
 * At ~5 m per bucket a car at 80 m/s crosses more than a bucket per 60 Hz
 * frame — nearest-bucket lookup steps by up to a full bucket, interpolation
 * removes that quantization from speed/throttle comparisons.
 */
export const interpolateReferenceSample = (
  samples: ReferenceLapSample[],
  lapDistPct: number
): ReferenceLapSample | null => {
  const bucketCount = samples.length;

  if (bucketCount === 0) return null;

  const position = lapDistPct * bucketCount - 0.5;
  const lowerBucket =
    ((Math.floor(position) % bucketCount) + bucketCount) % bucketCount;
  const upperBucket = (lowerBucket + 1) % bucketCount;
  const t = position - Math.floor(position);

  const lower = samples[lowerBucket];
  const upper = samples[upperBucket];

  if (!lower || !upper) return lower ?? upper ?? null;

  const lerp = (a: number, b: number) => a * (1 - t) + b * t;
  // `longAccel` is optional in bindings (serde(default) on the Rust side) — normalize undefined to null.
  const lerpNullable = (
    a: number | null | undefined,
    b: number | null | undefined
  ) => (a != null && b != null ? lerp(a, b) : (a ?? b ?? null));

  return {
    speed: lerp(lower.speed, upper.speed),
    throttle: lerp(lower.throttle, upper.throttle),
    brake: lerp(lower.brake, upper.brake),
    latAccel: lerpNullable(lower.latAccel, upper.latAccel),
    longAccel: lerpNullable(lower.longAccel, upper.longAccel),
    steeringWheelAngle: lerp(
      lower.steeringWheelAngle,
      upper.steeringWheelAngle
    ),
  };
};

/**
 * The player's position on the lap, 0..1, or null when the sim has none. The
 * coach frame carries it on the overlay clock; `lapTiming` carries it only on
 * the 10 Hz tier, and drawing by that puts a run of trace buckets under one
 * speed — a step every tenth of a second. `lapTiming` remains the fallback for
 * a window no coach frame reaches: a preview, a story.
 */
export const playerLapDistPct = (
  coachFrame: CoachFrame | null,
  lapTiming: LapTimingFrame | null
): number | null => {
  const lapDistPct = coachFrame?.lapDistPct ?? lapTiming?.lap_dist_pct ?? null;

  return lapDistPct === null || lapDistPct < 0 ? null : lapDistPct;
};
