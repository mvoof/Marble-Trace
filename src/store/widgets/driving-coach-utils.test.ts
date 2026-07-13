import { describe, it, expect } from 'vitest';
import type { ChassisFrame, ReferenceLapSample } from '@/types/bindings';
import {
  buildTargetSpeedProfile,
  computeDrivingAdvisory,
  extractCornerTargets,
  findNextCornerTarget,
  getAverageTireWear,
  interpolateReferenceSample,
  isConditionMismatch,
  NEUTRAL_ADVISORY_STATE,
} from './driving-coach-utils';

const TRACK_LENGTH_M = 1000;
const BUCKET_COUNT = 1000;

const sample = (
  speed: number,
  throttle = 0,
  brake = 0,
  latAccel: number | null = 0,
  longAccel: number | null = 0
): ReferenceLapSample => ({
  speed,
  throttle,
  brake,
  latAccel,
  longAccel,
  steeringWheelAngle: 0,
});

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

const cornerSamples = buildSingleCornerSamples();
const cornerTargets = extractCornerTargets(cornerSamples, TRACK_LENGTH_M);

const baseAdvisoryInput = {
  trackLengthM: TRACK_LENGTH_M,
  cornerTargets,
  referenceSamples: cornerSamples,
  targetSpeedProfile: null,
  brakeAbsActive: false,
  currentThrottle: 1,
  currentBrake: 0,
  currentSteeringWheelAngle: 0,
  currentLatAccel: null,
  currentLongAccel: null,
};

describe('interpolateReferenceSample', () => {
  const samples = [sample(10), sample(20), sample(30), sample(40)];

  it('interpolates linearly between bucket centers', () => {
    // pct 0.25 → x = 0.25*4 - 0.5 = 0.5 → halfway between buckets 0 and 1.
    expect(interpolateReferenceSample(samples, 0.25)?.speed).toBeCloseTo(15, 5);
  });

  it('wraps across the lap boundary', () => {
    // pct 0 → x = -0.5 → halfway between the last and first buckets.
    expect(interpolateReferenceSample(samples, 0)?.speed).toBeCloseTo(25, 5);
  });
});

describe('extractCornerTargets', () => {
  it('finds the single corner apex and derives a positive braking deceleration', () => {
    expect(cornerTargets).toHaveLength(1);
    expect(cornerTargets[0].targetSpeed).toBeCloseTo(10, 0);
    expect(cornerTargets[0].brakingDecel).toBeGreaterThan(0);
  });

  it('records where the reference driver first pressed the brake', () => {
    // Braking starts at bucket 400 in the fixture profile.
    expect(cornerTargets[0].brakeStartPct).toBeCloseTo(0.4, 2);
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
    const ahead = findNextCornerTarget(cornerTargets, 0.3, TRACK_LENGTH_M);
    expect(ahead?.distPct).toBeCloseTo(cornerTargets[0].distPct, 2);

    // Just past the apex — the same target is now behind us, so wrap to "none within range".
    const justPast = findNextCornerTarget(cornerTargets, 0.46, TRACK_LENGTH_M);
    expect(justPast).toBeNull();
  });
});

describe('buildTargetSpeedProfile', () => {
  it('derives the physics target speed from curvature and demonstrated grip', () => {
    // Half the lap at κ = 8/20² = 0.02 (grip-limited: v_target = ref speed),
    // half at κ = 2/20² = 0.005 (under-driven: v_target = √(8/0.005) = 40).
    const samples: ReferenceLapSample[] = new Array(BUCKET_COUNT);

    for (let i = 0; i < BUCKET_COUNT; i++) {
      samples[i] = i < 500 ? sample(20, 0.5, 0, 8) : sample(20, 0.5, 0, 2);
    }

    const profile = buildTargetSpeedProfile(samples);

    expect(profile).not.toBeNull();
    expect(profile?.[100]).toBeCloseTo(20, 1);
    expect(profile?.[700]).toBeCloseTo(40, 1);
  });

  it('leaves straights unconstrained and rejects laps without lateral data', () => {
    const straight: ReferenceLapSample[] = new Array(BUCKET_COUNT).fill(
      sample(50, 1, 0, 0.1)
    );
    const profile = buildTargetSpeedProfile(straight);

    // κ = 0.1/50² = 0.00004 < MIN_PROFILE_CURVATURE → no constraint anywhere.
    expect(profile?.every((target) => target === null)).toBe(true);

    const noLatData: ReferenceLapSample[] = new Array(BUCKET_COUNT).fill(
      sample(50, 1, 0, null)
    );
    expect(buildTargetSpeedProfile(noLatData)).toBeNull();
  });
});

describe('computeDrivingAdvisory', () => {
  it('advises brake when current speed cannot be shed in time for the apex', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 60,
        currentDistPct: 0.44, // right before the apex, almost no braking zone left
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('brake');
    expect(state.brakeCornerPct).toBeCloseTo(cornerTargets[0].distPct, 5);
    expect(state.brakeUrgency).toBe(1);
  });

  it('advises brake for the whole reference braking zone while above the apex speed', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 45,
        currentDistPct: 0.405, // just inside the zone, apex target is 10 m/s
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
        currentDistPct: 0.44,
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
        currentBrake: 0.9,
        currentDistPct: 0.45,
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
      },
      stillBraking
    );

    expect(released.advisory).toBe('neutral');
  });

  it('stays neutral at reference pace on the straight', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 59, // within the gas deadzone of the 60 m/s reference
        currentDistPct: 0.2,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('neutral');
  });

  it('reports partial brake urgency on the approach before the call fires', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 59,
        currentDistPct: 0.2, // 250 m from the apex
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.brakeUrgency).toBeGreaterThan(0);
    expect(state.brakeUrgency).toBeLessThan(1);
  });

  it('advises brake on mid-corner overspeed vs. the physics target profile', () => {
    const profile: (number | null)[] = new Array(BUCKET_COUNT).fill(null);
    profile[200] = 30;

    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        targetSpeedProfile: profile,
        currentSpeed: 40, // > 30 * 1.05
        currentDistPct: 0.2005,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('brake');
  });

  it('advises brake when under-braking during the reference braking phase without a detected corner target', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        cornerTargets: [], // decel derivation failed — zone/feasibility checks unavailable
        currentSpeed: 45, // reference is ~38 here and hard on the brakes
        currentBrake: 0.1,
        currentDistPct: 0.422,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('brake');
  });

  it('advises gas when well under the reference speed on a full-throttle straight', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 50,
        currentThrottle: 0.5,
        currentDistPct: 0.1,
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
      },
      latched
    );

    expect(stillClosing.advisory).toBe('gas');

    const closed = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentSpeed: 59.8,
        currentDistPct: 0.2,
      },
      stillClosing
    );

    expect(closed.advisory).toBe('neutral');
  });

  it('advises gas on combined-grip headroom even when the reference is not flat out', () => {
    // Reference: mid-exit at 0.6 throttle pulling 8 m/s² lateral. Player is
    // slower and uses well under that grip, on a matching line (Δlat < 4).
    const gripSamples: ReferenceLapSample[] = new Array(BUCKET_COUNT).fill(
      sample(30, 0.6, 0, 8)
    );

    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        referenceSamples: gripSamples,
        cornerTargets: [],
        currentSpeed: 27,
        currentThrottle: 0.4,
        currentLatAccel: 5,
        currentLongAccel: 0,
        currentDistPct: 0.5,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('gas');
  });

  it('suppresses the brake call when ABS is already active', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        brakeAbsActive: true,
        currentSpeed: 60,
        currentDistPct: 0.44,
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
        currentSpeed: 60,
        currentDistPct: 0.44,
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
        currentSpeed: 50,
        currentThrottle: 0.5,
        currentDistPct: 0.1,
      },
      NEUTRAL_ADVISORY_STATE
    );

    expect(state.advisory).toBe('neutral');
  });

  it('suppresses the gas call when lateral acceleration diverges from the reference at this point', () => {
    const state = computeDrivingAdvisory(
      {
        ...baseAdvisoryInput,
        currentLatAccel: 12, // reference recorded 0 here
        currentSpeed: 50,
        currentThrottle: 0.5,
        currentDistPct: 0.1,
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
