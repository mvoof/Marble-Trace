import { describe, expect, it } from 'vitest';

import {
  MOCK_STEERING_PEAK_RAD,
  mockInputHistory,
  type MockInputSample,
} from './inputs';

const indexOfMax = (
  samples: MockInputSample[],
  read: (sample: MockInputSample) => number
): number =>
  samples.reduce(
    (best, sample, index) =>
      read(sample) > read(samples[best]) ? index : best,
    0
  );

describe('mockInputHistory', () => {
  it('produces a history of the requested length', () => {
    expect(mockInputHistory(120)).toHaveLength(120);
    expect(mockInputHistory(7)).toHaveLength(7);
    expect(mockInputHistory().length).toBeGreaterThan(0);
  });

  it('keeps every channel inside its valid range', () => {
    for (const sample of mockInputHistory(500)) {
      expect(sample.throttle).toBeGreaterThanOrEqual(0);
      expect(sample.throttle).toBeLessThanOrEqual(1);
      expect(sample.brake).toBeGreaterThanOrEqual(0);
      expect(sample.brake).toBeLessThanOrEqual(1);
      expect(sample.clutch).toBeGreaterThanOrEqual(0);
      expect(sample.clutch).toBeLessThanOrEqual(1);
      expect(Math.abs(sample.steeringWheelAngle)).toBeLessThanOrEqual(
        MOCK_STEERING_PEAK_RAD
      );
    }
  });

  it('runs the phases in order: braking, trail braking, apex, throttle', () => {
    const samples = mockInputHistory(360);

    const peakBrake = indexOfMax(samples, (sample) => sample.brake);
    const peakSteering = indexOfMax(samples, (sample) =>
      Math.abs(sample.steeringWheelAngle)
    );
    const fullThrottle = samples.findIndex(
      (sample, index) => index > peakBrake && sample.throttle === 1
    );

    expect(peakBrake).toBeLessThan(peakSteering);
    expect(peakSteering).toBeLessThan(fullThrottle);

    // Trail braking: between the brake peak and the apex the brake is still
    // open while the wheel is already most of the way to full lock.
    const trailBraking = samples.filter(
      (sample) =>
        sample.brake > 0 &&
        Math.abs(sample.steeringWheelAngle) > MOCK_STEERING_PEAK_RAD / 2
    );

    expect(trailBraking.length).toBeGreaterThan(0);
  });

  it('never opens throttle and brake together', () => {
    for (const sample of mockInputHistory(360)) {
      expect(Math.min(sample.throttle, sample.brake)).toBe(0);
    }
  });

  it('chatters ABS only under heavy braking', () => {
    const samples = mockInputHistory(360);
    const absSamples = samples.filter((sample) => sample.brakeAbsActive);

    expect(absSamples.length).toBeGreaterThan(1);

    for (const sample of absSamples) {
      expect(sample.brake).toBeGreaterThan(0.5);
    }
  });
});
