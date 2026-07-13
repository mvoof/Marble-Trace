import { describe, it, expect } from 'vitest';
import type { ChassisFrame, ReferenceLapSample } from '@/types/bindings';
import {
  computeDrivingAdvisory,
  extractCornerTargets,
  findNextCornerTarget,
  getAverageTireWear,
  isConditionMismatch,
  NEUTRAL_ADVISORY_STATE,
} from './driving-coach-utils';

const TRACK_LENGTH_M = 1000;
const BUCKET_COUNT = 1000;

const sample = (
  speed: number,
  throttle = 0,
  brake = 0
): ReferenceLapSample => ({
  speed,
  throttle,
  brake,
  latAccel: null,
  steeringWheelAngle: 0,
});

const baseAdvisoryInput = {
  brakeAbsActive: false,
  currentSteeringWheelAngle: 0,
  referenceSteeringWheelAngleAtCurrent: null,
  currentLatAccel: null,
  referenceLatAccelAtCurrent: null,
};

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

describe('extractCornerTargets braking zone', () => {
  it('records where the reference driver first pressed the brake', () => {
    const targets = extractCornerTargets(
      buildSingleCornerSamples(),
      TRACK_LENGTH_M
    );

    // Braking starts at bucket 400 in the fixture profile.
    expect(targets[0].brakeStartPct).toBeCloseTo(0.4, 2);
  });
});

describe('computeDrivingAdvisory', () => {
  const targets = extractCornerTargets(
    buildSingleCornerSamples(),
    TRACK_LENGTH_M
  );

  it('advises brake when current speed cannot be shed in time for the apex', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 60,
        currentThrottle: 1,
        currentDistPct: 0.44, // right before the apex, almost no braking zone left
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 20,
        referenceThrottleAtCurrent: 0,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('brake');
    expect(state.brakeCornerPct).toBeCloseTo(targets[0].distPct, 5);
  });

  it('advises brake when overspeeding inside the reference braking zone even if still kinematically feasible', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 45, // reference is ~55 here and already braking
        currentThrottle: 1,
        currentDistPct: 0.405,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 55,
        referenceThrottleAtCurrent: 0,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('brake');
  });

  it('holds the brake latch through the zone until the target speed is reached', () => {
    const latched = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 60,
        currentThrottle: 1,
        currentDistPct: 0.44,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 20,
        referenceThrottleAtCurrent: 0,
      },
      NEUTRAL_ADVISORY_STATE
    );

    // Player is now braking hard — the momentary feasibility check alone would
    // release, but the latch must hold while still above the apex target speed.
    const stillBraking = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 25,
        currentThrottle: 0,
        currentDistPct: 0.45,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 12,
        referenceThrottleAtCurrent: 0,
      },
      latched
    );

    expect(stillBraking.advisory).toBe('brake');

    // Slowed to the apex target — latch releases.
    const released = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 10,
        currentThrottle: 0,
        currentDistPct: 0.452,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 10,
        referenceThrottleAtCurrent: 0,
      },
      stillBraking
    );

    expect(released.advisory).toBe('neutral');
  });

  it('stays neutral when on the reference braking curve ahead of the braking zone', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 30,
        currentThrottle: 0,
        currentDistPct: 0.3, // long before the zone, slow enough for the apex
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 60,
        referenceThrottleAtCurrent: 0,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('neutral');
  });

  it('advises gas when well under the reference speed on a full-throttle straight', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 50,
        currentThrottle: 0.5,
        currentDistPct: 0.1,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 60,
        referenceThrottleAtCurrent: 1,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('gas');
  });

  it('holds the gas latch while the deficit is closing, releases once it has closed', () => {
    const latched = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 50,
        currentThrottle: 0.5,
        currentDistPct: 0.1,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 60,
        referenceThrottleAtCurrent: 1,
      },
      NEUTRAL_ADVISORY_STATE
    );

    // Deficit shrank below the 2 m/s entry deadzone but not yet closed —
    // without the latch this would flicker to neutral.
    const stillClosing = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 59,
        currentThrottle: 0.9,
        currentDistPct: 0.15,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 60,
        referenceThrottleAtCurrent: 1,
      },
      latched
    );

    expect(stillClosing.advisory).toBe('gas');

    const closed = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 59.8,
        currentThrottle: 1,
        currentDistPct: 0.2,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 60,
        referenceThrottleAtCurrent: 1,
      },
      stillClosing
    );

    expect(closed.advisory).toBe('neutral');
  });

  it('suppresses the brake call when ABS is already active', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        brakeAbsActive: true,
        currentSpeed: 60,
        currentThrottle: 1,
        currentDistPct: 0.44,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 20,
        referenceThrottleAtCurrent: 0,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('neutral');
  });

  it('still advises brake on a diverging line — overspeed toward an apex must brake regardless', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSteeringWheelAngle: 1.2,
        referenceSteeringWheelAngleAtCurrent: 0,
        currentSpeed: 60,
        currentThrottle: 1,
        currentDistPct: 0.44,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 20,
        referenceThrottleAtCurrent: 0,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('brake');
  });

  it('suppresses the gas call when steering diverges from the reference at this point (different line/phase)', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSteeringWheelAngle: 1.2,
        referenceSteeringWheelAngleAtCurrent: 0,
        currentSpeed: 50,
        currentThrottle: 0.5,
        currentDistPct: 0.1,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 60,
        referenceThrottleAtCurrent: 1,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('neutral');
  });

  it('suppresses the gas call when lateral acceleration diverges from the reference at this point', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentLatAccel: 12,
        referenceLatAccelAtCurrent: 0,
        currentSpeed: 50,
        currentThrottle: 0.5,
        currentDistPct: 0.1,
        trackLengthM: TRACK_LENGTH_M,
        cornerTargets: targets,
        referenceSpeedAtCurrent: 60,
        referenceThrottleAtCurrent: 1,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('neutral');
  });
});

describe('getAverageTireWear', () => {
  const emptyChassis: ChassisFrame = {
    lf_ride_height: null,
    rf_ride_height: null,
    lr_ride_height: null,
    rr_ride_height: null,
    lf_shock_defl: null,
    rf_shock_defl: null,
    lr_shock_defl: null,
    rr_shock_defl: null,
    lf_temp_cl: null,
    lf_temp_cm: null,
    lf_temp_cr: null,
    rf_temp_cl: null,
    rf_temp_cm: null,
    rf_temp_cr: null,
    lr_temp_cl: null,
    lr_temp_cm: null,
    lr_temp_cr: null,
    rr_temp_cl: null,
    rr_temp_cm: null,
    rr_temp_cr: null,
    lf_pressure: null,
    rf_pressure: null,
    lr_pressure: null,
    rr_pressure: null,
    lf_wear_l: null,
    lf_wear_m: null,
    lf_wear_r: null,
    rf_wear_l: null,
    rf_wear_m: null,
    rf_wear_r: null,
    lr_wear_l: null,
    lr_wear_m: null,
    lr_wear_r: null,
    rr_wear_l: null,
    rr_wear_m: null,
    rr_wear_r: null,
    lf_brake_temp: null,
    rf_brake_temp: null,
    lr_brake_temp: null,
    rr_brake_temp: null,
  };

  it('returns null when there is no wear data', () => {
    expect(getAverageTireWear(null)).toBeNull();
    expect(getAverageTireWear(emptyChassis)).toBeNull();
  });

  it('averages whatever wear readings are present', () => {
    const chassis: ChassisFrame = {
      ...emptyChassis,
      lf_wear_l: 0.8,
      lf_wear_m: 1.0,
    };

    expect(getAverageTireWear(chassis)).toBeCloseTo(0.9, 5);
  });
});

describe('isConditionMismatch', () => {
  const baseConditions = {
    currentWetness: null,
    recordedWetness: null,
    currentTireWear: null,
    recordedTireWear: null,
    currentFuelLevel: null,
    recordedFuelLevel: null,
  };

  it('is false when nothing to compare or conditions match', () => {
    expect(isConditionMismatch(baseConditions)).toBe(false);
    expect(
      isConditionMismatch({
        ...baseConditions,
        currentWetness: 2,
        recordedWetness: 2,
      })
    ).toBe(false);
  });

  it('flags a large wetness divergence', () => {
    expect(
      isConditionMismatch({
        ...baseConditions,
        currentWetness: 5,
        recordedWetness: 0,
      })
    ).toBe(true);
  });

  it('flags a large tire wear divergence', () => {
    expect(
      isConditionMismatch({
        ...baseConditions,
        currentTireWear: 0.4,
        recordedTireWear: 0.95,
      })
    ).toBe(true);
  });

  it('flags a large fuel level divergence', () => {
    expect(
      isConditionMismatch({
        ...baseConditions,
        currentFuelLevel: 60,
        recordedFuelLevel: 10,
      })
    ).toBe(true);
  });
});
