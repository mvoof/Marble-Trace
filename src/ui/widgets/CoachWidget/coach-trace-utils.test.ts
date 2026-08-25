import { describe, expect, it } from 'vitest';

import type { ReferenceLapSample } from '@/types/bindings';
import {
  createTraceWindowBuffers,
  fillTraceWindow,
  NO_VALUE,
  traceValueRange,
  TRACE_POINT_COUNT,
  type TraceWindowBuffers,
} from './coach-trace-utils';

import { REFERENCE_LAP_BUCKET_COUNT as BUCKET_COUNT } from '@utils/backend-constants';
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

      // 0.01 of a 4000 m lap behind the car.
      expect(stats.referenceBrakeOffsetM).toBeCloseTo(-40, 0);
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

      expect(stats.ownBrakeOffsetM).not.toBeNull();
      expect(stats.brakeDeltaM).toBeNull();
    });

    it('finds this lap braking point', () => {
      const buffers = createTraceWindowBuffers();
      const ownBrake = new Float32Array(BUCKET_COUNT).fill(0);

      for (let bucket = 495; bucket < BUCKET_COUNT; bucket++) {
        ownBrake[bucket] = 1;
      }

      expect(
        fill(buffers, { ownBrakeByBucket: ownBrake }).ownBrakeOffsetM
      ).toBeCloseTo(-20, 0);
    });

    it('reports no braking point when the brake was never touched', () => {
      const buffers = createTraceWindowBuffers();
      const stats = fill(buffers);

      expect(stats.referenceBrakeOffsetM).toBeNull();
      expect(stats.ownBrakeOffsetM).toBeNull();
    });

    it('ignores braking already underway at the window edge', () => {
      const buffers = createTraceWindowBuffers();
      const stats = fill(buffers, {
        referenceSamples: referenceLap(50, () => 1),
      });

      expect(stats.referenceBrakeOffsetM).toBeNull();
    });
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
