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

/**
 * Below this speed (m/s) somewhere in a phase, this lap is not comparable
 * there: the car stopped, spun or was towed, and the phase time would be a
 * figure in the tens of seconds that says nothing about the driving.
 */
const MIN_COMPARABLE_SPEED_MPS = 3;

/**
 * A phase this short (metres) behind the car has no time to show yet: both
 * ends would read the same stretch of the trace and claim an even 0.00.
 */
const MIN_PHASE_DRIVEN_M = 5;

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
 * One lap's way through the corner the window is about, in metres from the
 * car: on the brakes, off them and through the apex, back on the power. A
 * point the lap has not reached is null; one behind the window's left edge is
 * reported where it lies.
 */
export interface CornerPhases {
  /**
   * Where the braking zone starts as drawn: the braking point, or where the
   * searched stretch begins when the brake is already down there.
   */
  brakeZoneStartM: number | null;
  /** Where the pedal went down. Null when that happened before the searched stretch. */
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

/** A lap position folded back into 0..1, across the line either way. */
export const wrapPct = (pct: number): number => ((pct % 1) + 1) % 1;

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

type TraceField = 'speed' | 'brake' | 'throttle';

/** One trace read anywhere around the car, between the drawn samples; `NO_VALUE` where it has nothing. */
type TraceReader = (field: TraceField, offsetM: number) => number;

/**
 * What the two readers read on the current frame. Set once per
 * `fillTraceWindow` rather than captured in closures built per frame: the
 * window is refilled on every telemetry frame and must not allocate.
 */
const frameSource: {
  referenceSamples: ReferenceLapSample[] | null;
  ownSpeedByBucket: Float32Array;
  ownBrakeByBucket: Float32Array;
  ownThrottleByBucket: Float32Array;
  currentDistPct: number;
  trackLengthM: number;
} = {
  referenceSamples: null,
  ownSpeedByBucket: new Float32Array(0),
  ownBrakeByBucket: new Float32Array(0),
  ownThrottleByBucket: new Float32Array(0),
  currentDistPct: 0,
  trackLengthM: 1,
};

const pctAt = (offsetM: number): number =>
  wrapPct(frameSource.currentDistPct + offsetM / frameSource.trackLengthM);

const readReference: TraceReader = (field, offsetM) =>
  referenceValueAt(frameSource.referenceSamples, field, pctAt(offsetM));

const ownBucketsFor = (field: TraceField): Float32Array => {
  if (field === 'speed') {
    return frameSource.ownSpeedByBucket;
  }

  return field === 'brake'
    ? frameSource.ownBrakeByBucket
    : frameSource.ownThrottleByBucket;
};

/**
 * Nothing ahead of the car has been driven this lap yet, and a bucket the car
 * has not reached still holds the previous lap's value until it is cleared —
 * both must read as absent rather than as a flat line.
 */
const readOwn: TraceReader = (field, offsetM) =>
  offsetM > 0 ? NO_VALUE : bucketValueAt(ownBucketsFor(field), pctAt(offsetM));

/**
 * How far behind the window a corner is looked for. A corner whose braking
 * zone has scrolled off the left edge is still the one the car is in until its
 * exit is over; searched for inside the window alone, it gave way to the next
 * corner's braking before its apex and exit had been measured.
 */
const CORNER_LOOKBACK_M = 400;

/** Samples across the look-back — 5 m apart; every point found on them is located on the trace itself. */
const LOOKBACK_POINT_COUNT = 80;

const GRID_POINT_COUNT = LOOKBACK_POINT_COUNT + TRACE_POINT_COUNT;

/**
 * The stretch a corner is searched on: the look-back, then the drawn window.
 * One trace at a time, refilled in place.
 */
const grid = {
  offsetM: new Float32Array(GRID_POINT_COUNT),
  speed: new Float32Array(GRID_POINT_COUNT),
  brake: new Float32Array(GRID_POINT_COUNT),
  throttle: new Float32Array(GRID_POINT_COUNT),
};

const fillGrid = (
  windowOffsetM: Float32Array,
  windowSpeed: Float32Array,
  windowBrake: Float32Array,
  windowThrottle: Float32Array,
  read: TraceReader
) => {
  const windowStartM = windowOffsetM[0] ?? 0;
  const lookbackStep = CORNER_LOOKBACK_M / LOOKBACK_POINT_COUNT;

  for (let index = 0; index < LOOKBACK_POINT_COUNT; index++) {
    const offsetM = windowStartM - CORNER_LOOKBACK_M + index * lookbackStep;

    grid.offsetM[index] = offsetM;
    grid.speed[index] = read('speed', offsetM);
    grid.brake[index] = read('brake', offsetM);
    grid.throttle[index] = read('throttle', offsetM);
  }

  grid.offsetM.set(windowOffsetM, LOOKBACK_POINT_COUNT);
  grid.speed.set(windowSpeed, LOOKBACK_POINT_COUNT);
  grid.brake.set(windowBrake, LOOKBACK_POINT_COUNT);
  grid.throttle.set(windowThrottle, LOOKBACK_POINT_COUNT);
};

const isBraking = (brake: number) => brake > BRAKE_ON_THRESHOLD;
const isOffBrake = (brake: number) => brake <= BRAKE_ON_THRESHOLD;

/** A rule on both pedals at one point. Comparisons with `NO_VALUE` are false, so a gap never matches. */
type PedalRule = (brake: number, throttle: number) => boolean;

const brakeOn: PedalRule = (brake) => isBraking(brake);

const brakeOff: PedalRule = (brake) => isOffBrake(brake);

/** Back on the power — with the brake off, so throttle blipped under braking is not taken for it. */
const throttleOpen: PedalRule = (brake, throttle) =>
  throttle > THROTTLE_OPEN_THRESHOLD && isOffBrake(brake);

/** The exit is over at full throttle, or where the next braking starts short of it. */
const exitOver: PedalRule = (brake, throttle) =>
  throttle >= FULL_THROTTLE_THRESHOLD || isBraking(brake);

/** First grid index at or after `from` where `rule` holds, stopping at the first gap. */
const findIndex = (from: number, rule: PedalRule): number | null => {
  for (let index = from; index < GRID_POINT_COUNT; index++) {
    const brake = grid.brake[index] ?? NO_VALUE;

    if (!isValue(brake)) return null;

    if (rule(brake, grid.throttle[index] ?? NO_VALUE)) return index;
  }

  return null;
};

const firstValueIndex = (values: Float32Array): number | null => {
  for (let index = 0; index < GRID_POINT_COUNT; index++) {
    if (isValue(values[index] ?? NO_VALUE)) return index;
  }

  return null;
};

/** Last index from `from` on before the first gap — how far this trace reaches. */
const lastValueIndex = (values: Float32Array, from: number): number => {
  let last = from;

  for (let index = from; index < GRID_POINT_COUNT; index++) {
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

/** Halvings of the gap between two samples when locating a pedal edge: 5 m down to a few millimetres. */
const EDGE_REFINE_STEPS = 11;

/** Points read across the two samples either side of the lowest one when locating the apex. */
const APEX_REFINE_POINTS = 24;

/**
 * Where `rule` first holds between the grid sample before `index` and `index`
 * itself, in metres from the car — found on the trace itself rather than on
 * the samples, and by the same rule that found `index`. The window's sampling
 * grid slides along the track as the car moves; a point snapped to it, or
 * interpolated across it, moves by up to a sample from frame to frame, and
 * every figure measured from it flickers.
 */
const refineEdge = (
  index: number | null,
  read: TraceReader,
  rule: PedalRule
): number | null => {
  if (index === null) return null;

  let high = grid.offsetM[index];
  let low = grid.offsetM[index - 1];

  if (high === undefined) return null;

  if (low === undefined) return high;

  for (let step = 0; step < EDGE_REFINE_STEPS; step++) {
    const middle = (low + high) / 2;

    if (rule(read('brake', middle), read('throttle', middle))) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return high;
};

/** The lowest speed around the lowest grid sample, read on the trace itself — see `refineEdge`. */
const refineApex = (index: number | null, read: TraceReader): number | null => {
  if (index === null) return null;

  const centre = grid.offsetM[index];

  if (centre === undefined) return null;

  const fromM = grid.offsetM[index - 1] ?? centre;
  const toM = grid.offsetM[index + 1] ?? centre;
  let lowestAt = centre;
  let lowest = read('speed', centre);

  for (let point = 0; point <= APEX_REFINE_POINTS; point++) {
    const pointM = fromM + ((toM - fromM) * point) / APEX_REFINE_POINTS;
    const value = read('speed', pointM);

    if (isValue(value) && !(value >= lowest)) {
      lowest = value;
      lowestAt = pointM;
    }
  }

  return lowestAt;
};

/** One corner's phase boundaries as grid indexes, written in place by `scanCorner`. */
const cornerIndexes = {
  zoneStart: null as number | null,
  release: null as number | null,
  throttlePoint: null as number | null,
  fullThrottle: null as number | null,
};

/**
 * The corner whose braking starts at or after `from`. Each phase is searched
 * for only after the one before it, so a lift on the straight is not taken for
 * a throttle point and the next corner's braking is not taken for this one's.
 */
const scanCorner = (from: number) => {
  const zoneStart = findIndex(from, brakeOn);
  const release = zoneStart === null ? null : findIndex(zoneStart, brakeOff);
  const throttlePoint =
    release === null ? null : findIndex(release, throttleOpen);

  cornerIndexes.zoneStart = zoneStart;
  cornerIndexes.release = release;
  cornerIndexes.throttlePoint = throttlePoint;
  cornerIndexes.fullThrottle =
    throttlePoint === null ? null : findIndex(throttlePoint, exitOver);
};

/**
 * The corner the window is about, split into the phases a driver works
 * through: the brake goes down, comes off, the speed bottoms out, the throttle
 * opens and reaches full. It is the first corner whose exit reaches into the
 * window — searched for in the look-back too, so a long corner keeps its
 * phases once its braking has scrolled off the edge — unless the car has
 * already braked for the next one. Found on the grid, then located precisely
 * on the trace through `read`. Points before the window are reported as they
 * are, beyond the left edge.
 */
const findCornerPhases = (read: TraceReader): CornerPhases => {
  const windowStartM = grid.offsetM[LOOKBACK_POINT_COUNT] ?? 0;
  const firstValue = firstValueIndex(grid.brake);

  // A lap that has only just started has nothing behind the car yet.
  if (firstValue === null) return NO_CORNER_PHASES;

  let from = firstValue;

  for (;;) {
    scanCorner(from);

    const { zoneStart, fullThrottle } = cornerIndexes;

    if (zoneStart === null) return NO_CORNER_PHASES;

    if (fullThrottle === null) break;

    const fullThrottleM = grid.offsetM[fullThrottle] ?? 0;
    const nextZoneStart = findIndex(fullThrottle, brakeOn);
    const isInNextCorner =
      fullThrottleM <= 0 &&
      nextZoneStart !== null &&
      (grid.offsetM[nextZoneStart] ?? 0) <= 0;

    if (fullThrottleM >= windowStartM && !isInNextCorner) break;

    if (nextZoneStart === null) return NO_CORNER_PHASES;

    from = nextZoneStart;
  }

  const { zoneStart, release, throttlePoint, fullThrottle } = cornerIndexes;

  if (zoneStart === null) return NO_CORNER_PHASES;

  // The braking point is a rising edge: the pedal already down where the trace
  // begins went down somewhere it does not reach.
  const brakePointM =
    zoneStart > firstValue ? refineEdge(zoneStart, read, brakeOn) : null;
  const apex = findApex(
    grid.speed,
    zoneStart,
    fullThrottle ?? lastValueIndex(grid.speed, zoneStart)
  );

  return {
    brakeZoneStartM: brakePointM ?? grid.offsetM[zoneStart] ?? null,
    brakePointM,
    brakeReleaseM: refineEdge(release, read, brakeOff),
    apexM: refineApex(apex, read),
    throttlePointM: refineEdge(throttlePoint, read, throttleOpen),
    fullThrottleM: refineEdge(fullThrottle, read, exitOver),
  };
};

/**
 * Time gained or lost inside one phase of the reference's corner:
 * - `running` — the car is inside the phase; the figure grows with it;
 * - `settled` — the car is past it; the figure is what the phase cost.
 */
export type PhaseTimeKind = 'running' | 'settled';

export interface PhaseTime {
  kind: PhaseTimeKind;
  /** Seconds; positive = lost against the reference, negative = gained. */
  deltaS: number;
}

/**
 * Where `atM` falls on the window's sample grid, as a fractional index;
 * `NO_VALUE` outside the window.
 */
export const windowIndexAt = (offsetM: Float32Array, atM: number): number => {
  const first = offsetM[0];
  const last = offsetM[TRACE_POINT_COUNT - 1];

  if (first === undefined || last === undefined || last <= first) {
    return NO_VALUE;
  }

  const position = ((atM - first) / (last - first)) * (TRACE_POINT_COUNT - 1);

  return position < 0 || position > TRACE_POINT_COUNT - 1 ? NO_VALUE : position;
};

/** `timeDeltaS` at a point of the window, between the drawn samples. */
const timeDeltaAt = (buffers: TraceWindowBuffers, offsetM: number): number => {
  const position = windowIndexAt(buffers.offsetM, offsetM);

  if (!isValue(position)) return NO_VALUE;

  const lowerIndex = Math.floor(position);
  const lower = buffers.timeDeltaS[lowerIndex] ?? NO_VALUE;
  const upper = buffers.timeDeltaS[lowerIndex + 1] ?? NO_VALUE;

  if (!isValue(upper)) return lower;

  if (!isValue(lower)) return upper;

  return lower + (upper - lower) * (position - lowerIndex);
};

/**
 * How much time this lap has gained or lost against the reference between
 * `startM` and `endM` — one phase of the reference's corner, in metres from the
 * car. Read off the running time delta, so the three phases of a corner add up
 * to what the corner cost. Null before the car reaches the phase, once its
 * start has left the window, where this lap's trace does not cover its start,
 * and where the car all but stopped in it: a car that was parked, reset or
 * towed has not driven it.
 */
export const phaseTime = (
  buffers: TraceWindowBuffers,
  startM: number | null,
  endM: number | null
): PhaseTime | null => {
  if (startM === null || startM > 0) {
    return null;
  }

  const atStart = timeDeltaAt(buffers, startM);
  const passed = endM !== null && endM <= 0;
  const untilM = passed ? endM : 0;
  const atEnd = timeDeltaAt(buffers, untilM);

  if (!isValue(atStart) || !isValue(atEnd)) {
    return null;
  }

  // A phase just entered has no time to show yet; one already driven has its
  // time however short it was.
  if (!passed && untilM - startM < MIN_PHASE_DRIVEN_M) {
    return null;
  }

  // This lap must have been recorded inside the phase, and never all but
  // stopped there.
  let recordedInside = false;

  for (let index = 0; index < TRACE_POINT_COUNT; index++) {
    const offsetM = buffers.offsetM[index] ?? NO_VALUE;
    const speed = buffers.ownSpeed[index] ?? NO_VALUE;

    if (offsetM < startM || offsetM > untilM || !isValue(speed)) continue;

    if (speed < MIN_COMPARABLE_SPEED_MPS) {
      return null;
    }

    recordedInside = true;
  }

  // A phase shorter than a sample may hold none; both its ends were read on
  // this lap's trace all the same.
  const stepM = (buffers.offsetM[1] ?? 0) - (buffers.offsetM[0] ?? 0);

  if (!recordedInside && untilM - startM >= stepM) {
    return null;
  }

  return { kind: passed ? 'settled' : 'running', deltaS: atEnd - atStart };
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

  frameSource.referenceSamples = referenceSamples;
  frameSource.ownSpeedByBucket = ownSpeedByBucket;
  frameSource.ownBrakeByBucket = ownBrakeByBucket;
  frameSource.ownThrottleByBucket = ownThrottleByBucket;
  frameSource.currentDistPct = currentDistPct;
  frameSource.trackLengthM = trackLengthM;

  const step = (windowMeters * 2) / (TRACE_POINT_COUNT - 1);

  let cumulativeDeltaS = NO_VALUE;
  let previousOwnSpeed = NO_VALUE;
  let previousReferenceSpeed = NO_VALUE;
  let hasData = false;

  for (let index = 0; index < TRACE_POINT_COUNT; index++) {
    const offsetM = -windowMeters + index * step;
    const referenceSpeed = readReference('speed', offsetM);
    const ownSpeed = readOwn('speed', offsetM);

    buffers.offsetM[index] = offsetM;
    buffers.referenceSpeed[index] = referenceSpeed;
    buffers.ownSpeed[index] = ownSpeed;
    buffers.referenceBrake[index] = readReference('brake', offsetM);
    buffers.ownBrake[index] = readOwn('brake', offsetM);
    buffers.referenceThrottle[index] = readReference('throttle', offsetM);
    buffers.ownThrottle[index] = readOwn('throttle', offsetM);

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

  fillGrid(
    buffers.offsetM,
    buffers.referenceSpeed,
    buffers.referenceBrake,
    buffers.referenceThrottle,
    readReference
  );
  const reference = findCornerPhases(readReference);

  fillGrid(
    buffers.offsetM,
    buffers.ownSpeed,
    buffers.ownBrake,
    buffers.ownThrottle,
    readOwn
  );
  const own = findCornerPhases(readOwn);

  return {
    windowDeltaS: isValue(cumulativeDeltaS) ? cumulativeDeltaS : null,
    reference,
    own,
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
