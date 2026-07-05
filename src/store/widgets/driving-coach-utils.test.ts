import { describe, it, expect } from 'vitest';
import type { ReferenceLapSample } from '@/types/bindings';
import {
  computeDrivingAdvisory,
  extractCornerTargets,
  findNextCornerTarget,
} from './driving-coach-utils';

const TRACK_LENGTH_M = 1000;
const BUCKET_COUNT = 1000;

const sample = (
  speed: number,
  throttle = 0,
  brake = 0
): ReferenceLapSample => ({ speed, throttle, brake });

/** Build a straight-brake-apex-throttle corner profile spanning the whole lap. */
const buildSingleCornerSamples = (): ReferenceLapSample[] => {
  const samples: ReferenceLapSample[] = new Array(BUCKET_COUNT);

  for (let i = 0; i < BUCKET_COUNT; i++) {
    if (i < 400) {
      samples[i] = sample(60, 1, 0); // straight, full throttle
    } else if (i < 450) {
      samples[i] = sample(60 - (i - 400) * 1, 0, 0.8); // braking zone
    } else if (i < 460) {
      samples[i] = sample(10, 0, 0); // apex
    } else {
      samples[i] = sample(10 + (i - 460) * 0.5, 1, 0); // corner exit, accelerating
    }
  }

  return samples;
};

describe('extractCornerTargets', () => {
  it('finds the single corner apex and derives a positive braking deceleration', () => {
    const targets = extractCornerTargets(
      buildSingleCornerSamples(),
      TRACK_LENGTH_M
    );

    expect(targets).toHaveLength(1);
    expect(targets[0].targetSpeed).toBeCloseTo(10, 0);
    expect(targets[0].brakingDecel).toBeGreaterThan(0);
  });

  it('ignores noise below the minimum speed-drop threshold', () => {
    const samples: ReferenceLapSample[] = new Array(BUCKET_COUNT).fill(
      sample(60, 1, 0)
    );
    // tiny 1 km/h wobble — should not be detected as a corner
    samples[500] = sample(59.7, 1, 0);

    expect(extractCornerTargets(samples, TRACK_LENGTH_M)).toHaveLength(0);
  });
});

describe('findNextCornerTarget', () => {
  it('finds the nearest target ahead, wrapping around the lap', () => {
    const targets = extractCornerTargets(
      buildSingleCornerSamples(),
      TRACK_LENGTH_M
    );

    const ahead = findNextCornerTarget(targets, 0.3, TRACK_LENGTH_M);
    expect(ahead?.distPct).toBeCloseTo(targets[0].distPct, 2);

    // Just past the apex — the same target is now behind us, so wrap to "none within range".
    const justPast = findNextCornerTarget(targets, 0.46, TRACK_LENGTH_M);
    expect(justPast).toBeNull();
  });
});

describe('computeDrivingAdvisory', () => {
  const targets = extractCornerTargets(
    buildSingleCornerSamples(),
    TRACK_LENGTH_M
  );

  it('advises brake when current speed cannot be shed in time for the apex', () => {
    const advisory = computeDrivingAdvisory({
      currentSpeed: 60,
      currentThrottle: 1,
      currentDistPct: 0.44, // right before the apex, almost no braking zone left
      trackLengthM: TRACK_LENGTH_M,
      cornerTargets: targets,
      referenceSpeedAtCurrent: 20,
      referenceThrottleAtCurrent: 0,
    });

    expect(advisory).toBe('brake');
  });

  it('stays neutral when on the reference braking curve', () => {
    const advisory = computeDrivingAdvisory({
      currentSpeed: 30,
      currentThrottle: 0,
      currentDistPct: 0.42,
      trackLengthM: TRACK_LENGTH_M,
      cornerTargets: targets,
      referenceSpeedAtCurrent: 30,
      referenceThrottleAtCurrent: 0,
    });

    expect(advisory).toBe('neutral');
  });

  it('advises gas when well under the reference speed on a full-throttle straight', () => {
    const advisory = computeDrivingAdvisory({
      currentSpeed: 50,
      currentThrottle: 0.5,
      currentDistPct: 0.1,
      trackLengthM: TRACK_LENGTH_M,
      cornerTargets: targets,
      referenceSpeedAtCurrent: 60,
      referenceThrottleAtCurrent: 1,
    });

    expect(advisory).toBe('gas');
  });
});
