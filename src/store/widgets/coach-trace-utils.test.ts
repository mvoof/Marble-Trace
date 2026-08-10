import { describe, expect, it } from 'vitest';

import type { ReferenceLapSample } from '@/types/bindings';
import {
  buildTraceWindow,
  traceSpeedRange,
  TRACE_POINT_COUNT,
  UNRECORDED_SPEED,
} from './coach-trace-utils';

const BUCKET_COUNT = 1000;
const TRACK_LENGTH_M = 4000;

const referenceLap = (speedMps: number): ReferenceLapSample[] =>
  Array.from({ length: BUCKET_COUNT }, () => ({
    speed: speedMps,
    throttle: 1,
    brake: 0,
    latAccel: null,
    longAccel: null,
    steeringWheelAngle: 0,
  }));

const ownLap = (speedMps: number): Float32Array =>
  new Float32Array(BUCKET_COUNT).fill(speedMps);

const emptyOwnLap = (): Float32Array =>
  new Float32Array(BUCKET_COUNT).fill(UNRECORDED_SPEED);

describe('buildTraceWindow', () => {
  it('spans the full window centred on the car', () => {
    const { points } = buildTraceWindow({
      referenceSamples: referenceLap(50),
      ownSpeedByBucket: ownLap(50),
      currentDistPct: 0.5,
      trackLengthM: TRACK_LENGTH_M,
      windowMeters: 150,
    });

    expect(points).toHaveLength(TRACE_POINT_COUNT);
    expect(points[0]?.offsetM).toBe(-150);
    expect(points.at(-1)?.offsetM).toBeCloseTo(150);
    expect(points[(TRACE_POINT_COUNT - 1) / 2]?.offsetM).toBeCloseTo(0);
  });

  it('reports no own-lap data ahead of the car', () => {
    const { points } = buildTraceWindow({
      referenceSamples: referenceLap(50),
      ownSpeedByBucket: ownLap(50),
      currentDistPct: 0.5,
      trackLengthM: TRACK_LENGTH_M,
      windowMeters: 150,
    });

    const ahead = points.filter((point) => point.offsetM > 0);
    const behind = points.filter((point) => point.offsetM < 0);

    expect(ahead.every((point) => point.ownSpeed === null)).toBe(true);
    expect(behind.every((point) => point.ownSpeed !== null)).toBe(true);
    // The reference is the only source of what lies ahead, so it must not stop
    // at the car the way the own trace does.
    expect(ahead.every((point) => point.referenceSpeed !== null)).toBe(true);
  });

  it('reports zero delta when both laps ran the same speed', () => {
    const { windowDeltaS } = buildTraceWindow({
      referenceSamples: referenceLap(50),
      ownSpeedByBucket: ownLap(50),
      currentDistPct: 0.5,
      trackLengthM: TRACK_LENGTH_M,
      windowMeters: 150,
    });

    expect(windowDeltaS).toBeCloseTo(0, 6);
  });

  it('reports lost time as positive when slower than the reference', () => {
    const { windowDeltaS } = buildTraceWindow({
      referenceSamples: referenceLap(50),
      ownSpeedByBucket: ownLap(40),
      currentDistPct: 0.5,
      trackLengthM: TRACK_LENGTH_M,
      windowMeters: 150,
    });

    // 150 m of the window lies behind the car: 150/40 - 150/50 = 0.75 s lost.
    expect(windowDeltaS).toBeCloseTo(0.75, 3);
  });

  it('reports gained time as negative when faster than the reference', () => {
    const { windowDeltaS } = buildTraceWindow({
      referenceSamples: referenceLap(40),
      ownSpeedByBucket: ownLap(50),
      currentDistPct: 0.5,
      trackLengthM: TRACK_LENGTH_M,
      windowMeters: 150,
    });

    expect(windowDeltaS).toBeCloseTo(-0.75, 3);
  });

  it('has no delta without a reference lap', () => {
    const { points, windowDeltaS } = buildTraceWindow({
      referenceSamples: null,
      ownSpeedByBucket: ownLap(50),
      currentDistPct: 0.5,
      trackLengthM: TRACK_LENGTH_M,
      windowMeters: 150,
    });

    expect(windowDeltaS).toBeNull();
    expect(points.every((point) => point.referenceSpeed === null)).toBe(true);
  });

  it('has no delta before the lap in progress has been recorded', () => {
    const { windowDeltaS } = buildTraceWindow({
      referenceSamples: referenceLap(50),
      ownSpeedByBucket: emptyOwnLap(),
      currentDistPct: 0.5,
      trackLengthM: TRACK_LENGTH_M,
      windowMeters: 150,
    });

    expect(windowDeltaS).toBeNull();
  });

  it('wraps across the start/finish line', () => {
    const { points } = buildTraceWindow({
      referenceSamples: referenceLap(50),
      ownSpeedByBucket: ownLap(50),
      currentDistPct: 0.001,
      trackLengthM: TRACK_LENGTH_M,
      windowMeters: 150,
    });

    // Everything behind the car sits at the end of the previous lap; nothing
    // may fall out of the sampled range.
    expect(points.every((point) => point.referenceSpeed === 50)).toBe(true);
  });

  it('returns nothing without a track length', () => {
    const { points, windowDeltaS } = buildTraceWindow({
      referenceSamples: referenceLap(50),
      ownSpeedByBucket: ownLap(50),
      currentDistPct: 0.5,
      trackLengthM: 0,
      windowMeters: 150,
    });

    expect(points).toHaveLength(0);
    expect(windowDeltaS).toBeNull();
  });
});

describe('traceSpeedRange', () => {
  it('covers both traces', () => {
    const { points } = buildTraceWindow({
      referenceSamples: referenceLap(60),
      ownSpeedByBucket: ownLap(40),
      currentDistPct: 0.5,
      trackLengthM: TRACK_LENGTH_M,
      windowMeters: 150,
    });

    expect(traceSpeedRange(points)).toEqual({ min: 40, max: 60 });
  });

  it('is null when there is nothing to draw', () => {
    expect(traceSpeedRange([])).toBeNull();
  });
});
