import { describe, expect, it } from 'vitest';

import type { ReferenceLapSample } from '@shared/contracts/generated/bindings';
import {
  createTraceWindowBuffers,
  fillTraceWindow,
  NO_VALUE,
  phaseTime,
  traceValueRange,
  TRACE_POINT_COUNT,
  type TraceWindowBuffers,
} from './coach-trace-utils';

import { REFERENCE_LAP_BUCKET_COUNT as BUCKET_COUNT } from '@shared/contracts/generated/backend-constants';
const TRACK_LENGTH_M = 4000;
const WINDOW_M = 150;
const NOW_INDEX = (TRACE_POINT_COUNT - 1) / 2;

const referenceLap = (
  speedMps: number,
  brakeAt?: (pct: number) => number
): ReferenceLapSample[] =>
  Array.from({ length: BUCKET_COUNT }, (_unused, index) => ({
    speed: speedMps,
    throttle: 1,
    brake: brakeAt ? brakeAt(index / BUCKET_COUNT) : 0,
    latAccel: null,
    longAccel: null,
    steeringWheelAngle: 0,
  }));

const ownLap = (speedMps: number): Float32Array =>
  new Float32Array(BUCKET_COUNT).fill(speedMps);

const noBrake = (): Float32Array => new Float32Array(BUCKET_COUNT).fill(0);

const fullThrottle = (): Float32Array => new Float32Array(BUCKET_COUNT).fill(1);

const emptyLap = (): Float32Array =>
  new Float32Array(BUCKET_COUNT).fill(NO_VALUE);

const fill = (
  buffers: TraceWindowBuffers,
  overrides: Partial<Parameters<typeof fillTraceWindow>[1]> = {}
) =>
  fillTraceWindow(buffers, {
    referenceSamples: referenceLap(50),
    ownSpeedByBucket: ownLap(50),
    ownBrakeByBucket: noBrake(),
    ownThrottleByBucket: fullThrottle(),
    currentDistPct: 0.5,
    trackLengthM: TRACK_LENGTH_M,
    windowMeters: WINDOW_M,
    ...overrides,
  });

const values = (buffer: Float32Array): number[] =>
  Array.from(buffer).filter((value) => !Number.isNaN(value));

describe('fillTraceWindow', () => {
  it('spans the full window centred on the car', () => {
    const buffers = createTraceWindowBuffers();

    fill(buffers);

    expect(buffers.offsetM).toHaveLength(TRACE_POINT_COUNT);
    expect(buffers.offsetM[0]).toBe(-WINDOW_M);
    expect(buffers.offsetM.at(-1)).toBeCloseTo(WINDOW_M);
    expect(buffers.offsetM[NOW_INDEX]).toBeCloseTo(0);
  });

  it('reports no own-lap data ahead of the car', () => {
    const buffers = createTraceWindowBuffers();

    fill(buffers);

    for (let index = 0; index < TRACE_POINT_COUNT; index++) {
      const offsetM = buffers.offsetM[index] ?? 0;
      const ownSpeed = buffers.ownSpeed[index] ?? NO_VALUE;

      expect(Number.isNaN(ownSpeed)).toBe(offsetM > 0);
      // The reference is the only source of what lies ahead, so it must not
      // stop at the car the way the own trace does.
      expect(Number.isNaN(buffers.referenceSpeed[index] ?? NO_VALUE)).toBe(
        false
      );
    }
  });

  it('draws a speed ramp on a long track as a slope, not a staircase', () => {
    // 20 m a bucket against 2.5 m a point: a nearest-bucket lookup held each
    // speed across eight points.
    const rampSpeed = (bucket: number) => 30 + bucket * 0.05;
    const referenceSamples = referenceLap(0).map((sample, bucket) => ({
      ...sample,
      speed: rampSpeed(bucket),
    }));
    const ownSpeedByBucket = Float32Array.from(
      { length: BUCKET_COUNT },
      (_unused, bucket) => rampSpeed(bucket) - 1
    );
    const buffers = createTraceWindowBuffers();

    fill(buffers, {
      referenceSamples,
      ownSpeedByBucket,
      trackLengthM: 20_800,
    });

    const isRising = (drawn: number[]) =>
      drawn.every(
        (value, index) => index === 0 || value > (drawn[index - 1] ?? 0)
      );

    expect(isRising(values(buffers.referenceSpeed))).toBe(true);
    expect(isRising(values(buffers.ownSpeed))).toBe(true);
  });

  it('reports zero delta when both laps ran the same speed', () => {
    const buffers = createTraceWindowBuffers();

    expect(fill(buffers).windowDeltaS).toBeCloseTo(0, 6);
  });

  it('reports lost time as positive when slower than the reference', () => {
    const buffers = createTraceWindowBuffers();

    // 150 m of the window lies behind the car: 150/40 - 150/50 = 0.75 s lost.
    expect(
      fill(buffers, { ownSpeedByBucket: ownLap(40) }).windowDeltaS
    ).toBeCloseTo(0.75, 3);
  });

  it('reports gained time as negative when faster than the reference', () => {
    const buffers = createTraceWindowBuffers();

    expect(
      fill(buffers, { referenceSamples: referenceLap(40) }).windowDeltaS
    ).toBeCloseTo(-0.75, 3);
  });

  it('has no delta without a reference lap', () => {
    const buffers = createTraceWindowBuffers();
    const stats = fill(buffers, { referenceSamples: null });

    expect(stats.windowDeltaS).toBeNull();
    expect(values(buffers.referenceSpeed)).toHaveLength(0);
  });

  it('has no delta before the lap in progress has been recorded', () => {
    const buffers = createTraceWindowBuffers();

    expect(
      fill(buffers, { ownSpeedByBucket: emptyLap() }).windowDeltaS
    ).toBeNull();
  });

  it('wraps across the start/finish line', () => {
    const buffers = createTraceWindowBuffers();

    fill(buffers, { currentDistPct: 0.001 });

    // Everything behind the car sits at the end of the previous lap; nothing
    // may fall out of the sampled range.
    expect(values(buffers.referenceSpeed)).toHaveLength(TRACE_POINT_COUNT);
  });

  it('returns nothing without a track length', () => {
    const buffers = createTraceWindowBuffers();
    const stats = fill(buffers, { trackLengthM: 0 });

    expect(stats.hasData).toBe(false);
    expect(stats.windowDeltaS).toBeNull();
    expect(values(buffers.referenceSpeed)).toHaveLength(0);
  });

  it('clears the previous window when it can no longer be built', () => {
    const buffers = createTraceWindowBuffers();

    fill(buffers);
    expect(values(buffers.ownSpeed).length).toBeGreaterThan(0);

    fill(buffers, { trackLengthM: 0 });
    expect(values(buffers.ownSpeed)).toHaveLength(0);
  });

  describe('braking points', () => {
    // The reference gets on the brakes 60 m before the car; braking is held
    // from there on, so only the rising edge may be reported.
    const brakeFromPct = (start: number) => (pct: number) =>
      pct >= start ? 1 : 0;

    it('finds the reference braking point as an offset from the car', () => {
      const buffers = createTraceWindowBuffers();
      const stats = fill(buffers, {
        referenceSamples: referenceLap(50, brakeFromPct(0.49)),
      });

      // 0.01 of a 4000 m lap behind the car — a little before it, where the
      // pedal crosses 5 % on its way up between two bucket centres.
      expect(Math.abs((stats.reference.brakePointM ?? 0) + 40)).toBeLessThan(3);
    });

    it('reports how much later this lap braked', () => {
      const buffers = createTraceWindowBuffers();
      const ownBrake = new Float32Array(BUCKET_COUNT).fill(0);

      for (let bucket = 495; bucket < BUCKET_COUNT; bucket++) {
        ownBrake[bucket] = 1;
      }

      const stats = fill(buffers, {
        referenceSamples: referenceLap(50, brakeFromPct(0.49)),
        ownBrakeByBucket: ownBrake,
      });

      // Reference brakes at 0.49, this lap at 0.495 — 20 m later on a 4000 m lap.
      expect(stats.brakeDeltaM).toBeCloseTo(20, 0);
    });

    it('has no braking comparison when only one mark is in the window', () => {
      const buffers = createTraceWindowBuffers();
      const ownBrake = new Float32Array(BUCKET_COUNT).fill(0);

      for (let bucket = 495; bucket < BUCKET_COUNT; bucket++) {
        ownBrake[bucket] = 1;
      }

      const stats = fill(buffers, { ownBrakeByBucket: ownBrake });

      expect(stats.own.brakePointM).not.toBeNull();
      expect(stats.brakeDeltaM).toBeNull();
    });

    it('finds this lap braking point', () => {
      const buffers = createTraceWindowBuffers();
      const ownBrake = new Float32Array(BUCKET_COUNT).fill(0);

      for (let bucket = 495; bucket < BUCKET_COUNT; bucket++) {
        ownBrake[bucket] = 1;
      }

      const ownBrakePointM = fill(buffers, { ownBrakeByBucket: ownBrake }).own
        .brakePointM;

      expect(Math.abs((ownBrakePointM ?? 0) + 20)).toBeLessThan(3);
    });

    it('reports no braking point when the brake was never touched', () => {
      const buffers = createTraceWindowBuffers();
      const stats = fill(buffers);

      expect(stats.reference.brakePointM).toBeNull();
      expect(stats.own.brakePointM).toBeNull();
    });

    it('ignores braking already underway at the window edge', () => {
      const buffers = createTraceWindowBuffers();
      const stats = fill(buffers, {
        referenceSamples: referenceLap(50, () => 1),
      });

      expect(stats.reference.brakePointM).toBeNull();
    });
  });
});

describe('corner phases', () => {
  // One corner: on the brakes from 0.49 to 0.495, off both pedals to 0.497,
  // half throttle to 0.505 and full after; slowest at 0.5. The car sits at
  // 0.52, so the whole corner lies behind it — 4 m a thousandth of the lap.
  const CAR_PCT = 0.52;
  const metresFromCar = (pct: number) => (pct - CAR_PCT) * TRACK_LENGTH_M;

  const brakeAt = (pct: number) => (pct >= 0.49 && pct < 0.495 ? 1 : 0);
  const throttleAt = (pct: number) =>
    pct >= 0.49 && pct < 0.497 ? 0 : pct < 0.505 && pct >= 0.497 ? 0.5 : 1;
  const speedAt = (pct: number) =>
    Math.min(30 + Math.abs(pct - 0.5) * 1000, 50);

  const cornerReference = (): ReferenceLapSample[] =>
    Array.from({ length: BUCKET_COUNT }, (_unused, index) => {
      const pct = index / BUCKET_COUNT;

      return {
        speed: speedAt(pct),
        throttle: throttleAt(pct),
        brake: brakeAt(pct),
        latAccel: null,
        longAccel: null,
        steeringWheelAngle: 0,
      };
    });

  /** The same corner driven `latePct` later in every phase. */
  const cornerOwn = (latePct: number) => {
    const byBucket = (sample: (pct: number) => number) =>
      Float32Array.from({ length: BUCKET_COUNT }, (_unused, index) =>
        sample(index / BUCKET_COUNT - latePct)
      );

    return {
      ownSpeedByBucket: byBucket(speedAt),
      ownBrakeByBucket: byBucket(brakeAt),
      ownThrottleByBucket: byBucket(throttleAt),
    };
  };

  /** A bucket is 4 m and the window is read between bucket centres. */
  const TOLERANCE_M = 3;

  const expectNear = (actual: number | null, expected: number) => {
    expect(actual).not.toBeNull();
    expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThan(
      TOLERANCE_M
    );
  };

  it('splits the reference corner into its phases', () => {
    const buffers = createTraceWindowBuffers();
    const { reference } = fill(buffers, {
      referenceSamples: cornerReference(),
      ...cornerOwn(0),
      currentDistPct: CAR_PCT,
    });

    expectNear(reference.brakePointM, metresFromCar(0.49));
    expectNear(reference.brakeReleaseM, metresFromCar(0.495));
    expectNear(reference.apexM, metresFromCar(0.5));
    expectNear(reference.throttlePointM, metresFromCar(0.497));
    expectNear(reference.fullThrottleM, metresFromCar(0.505));
  });

  it('reports how much later this lap reached every phase', () => {
    const buffers = createTraceWindowBuffers();
    const stats = fill(buffers, {
      referenceSamples: cornerReference(),
      ...cornerOwn(0.002),
      currentDistPct: CAR_PCT,
    });

    expectNear(stats.brakeDeltaM, 8);
    expectNear(stats.apexDeltaM, 8);
    expectNear(stats.throttleDeltaM, 8);
  });

  // The window's sampling grid slides along the track with the car; a point
  // snapped to it moved by a whole 2.5 m sample from frame to frame, and the
  // header figure flickered with it.
  it('keeps every miss steady as the car moves', () => {
    const buffers = createTraceWindowBuffers();
    const misses = {
      brake: [] as number[],
      apex: [] as number[],
      throttle: [] as number[],
    };

    for (let frame = 0; frame < 20; frame++) {
      // 0.2 m a frame — less than one sample, so the grid lands differently each time.
      const stats = fill(buffers, {
        referenceSamples: cornerReference(),
        ...cornerOwn(0.002),
        currentDistPct: CAR_PCT + frame * 0.00005,
      });

      misses.brake.push(stats.brakeDeltaM ?? Number.NaN);
      misses.apex.push(stats.apexDeltaM ?? Number.NaN);
      misses.throttle.push(stats.throttleDeltaM ?? Number.NaN);
    }

    const spread = (values: number[]) =>
      Math.max(...values) - Math.min(...values);

    // Half a metre: well under the 1 m the header rounds a miss to.
    expect(spread(misses.brake)).toBeLessThan(0.5);
    expect(spread(misses.apex)).toBeLessThan(0.5);
    expect(spread(misses.throttle)).toBeLessThan(0.5);
  });

  it('has no apex while this lap is still slowing', () => {
    const buffers = createTraceWindowBuffers();
    // The car sits just short of the apex: the lowest speed so far is the
    // latest one, not the corner's.
    const stats = fill(buffers, {
      referenceSamples: cornerReference(),
      ...cornerOwn(0),
      currentDistPct: 0.499,
    });

    expect(stats.own.brakePointM).not.toBeNull();
    expect(stats.own.apexM).toBeNull();
    expect(stats.apexDeltaM).toBeNull();
  });

  it('draws a braking zone already underway from the window edge', () => {
    const buffers = createTraceWindowBuffers();
    const { reference } = fill(buffers, {
      referenceSamples: referenceLap(50, () => 1),
    });

    expect(reference.brakeZoneStartM).toBe(-WINDOW_M);
    expect(reference.brakePointM).toBeNull();
  });
});

describe('phaseTime', () => {
  const STEP_M = (WINDOW_M * 2) / (TRACE_POINT_COUNT - 1);

  /** A window whose running delta is `deltaAt(offset)` behind the car, from `traceFromM` on. */
  const windowWithDelta = (
    deltaAt: (offsetM: number) => number,
    traceFromM = -WINDOW_M
  ): TraceWindowBuffers => {
    const buffers = createTraceWindowBuffers();

    for (let index = 0; index < TRACE_POINT_COUNT; index++) {
      const offsetM = -WINDOW_M + index * STEP_M;

      const recorded = offsetM <= 0 && offsetM >= traceFromM;

      buffers.offsetM[index] = offsetM;
      buffers.ownSpeed[index] = recorded ? 40 : NO_VALUE;
      buffers.timeDeltaS[index] = recorded ? deltaAt(offsetM) : NO_VALUE;
    }

    return buffers;
  };

  // Losing a hundredth every 10 m from 60 m behind the car on.
  const losing = windowWithDelta((offsetM) =>
    offsetM < -60 ? 0 : (offsetM + 60) * 0.001
  );

  it('is what the phase cost once the car is past it', () => {
    const time = phaseTime(losing, -50, -20);

    expect(time?.kind).toBe('settled');
    expect(time?.deltaS).toBeCloseTo(0.03, 6);
  });

  it('runs up to the car while the car is inside the phase', () => {
    const time = phaseTime(losing, -40, 30);

    expect(time?.kind).toBe('running');
    expect(time?.deltaS).toBeCloseTo(0.04, 6);
  });

  it('reads between the drawn samples', () => {
    // Neither end on the 2.5 m grid.
    expect(phaseTime(losing, -41.3, -21.3)?.deltaS).toBeCloseTo(0.02, 6);
  });

  it('has nothing before the car reaches the phase', () => {
    expect(phaseTime(losing, 10, 40)).toBeNull();
    expect(phaseTime(losing, null, -20)).toBeNull();
  });

  it('has nothing until the car is a little way into the phase', () => {
    // Both ends would read the same stretch of the trace and claim 0.00.
    expect(phaseTime(losing, -1, 30)).toBeNull();
  });

  it('has nothing for a phase this lap has no sample of its own in', () => {
    const unrecorded = windowWithDelta(() => 0);

    unrecorded.ownSpeed.fill(NO_VALUE);

    expect(phaseTime(unrecorded, -40, -20)).toBeNull();
  });

  it('has nothing for a phase the car all but stopped in', () => {
    // Spun, stopped or towed: tens of seconds that say nothing about the driving.
    const stopped = windowWithDelta((offsetM) => (offsetM + 150) * 0.5);

    for (let index = 0; index < TRACE_POINT_COUNT; index++) {
      stopped.ownSpeed[index] =
        (stopped.offsetM[index] ?? 0) <= 0 ? 0.5 : NO_VALUE;
    }

    expect(phaseTime(stopped, -40, -20)).toBeNull();
  });

  it('has nothing for a phase this lap was not seen to drive', () => {
    // Parked, reset or towed: the trace starts after the phase does.
    const shortTrace = windowWithDelta(() => 0, -10);

    expect(phaseTime(shortTrace, -40, -20)).toBeNull();
  });
});

describe('traceValueRange', () => {
  it('covers both traces', () => {
    const buffers = createTraceWindowBuffers();

    fill(buffers, {
      referenceSamples: referenceLap(60),
      ownSpeedByBucket: ownLap(40),
    });

    expect(traceValueRange(buffers.referenceSpeed, buffers.ownSpeed)).toEqual({
      min: 40,
      max: 60,
    });
  });

  it('is null when there is nothing to draw', () => {
    const empty = createTraceWindowBuffers();

    expect(traceValueRange(empty.referenceSpeed, empty.ownSpeed)).toBeNull();
  });
});
