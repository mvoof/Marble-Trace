// Mock builders for the driver-input domain. Pure: nothing here touches a
// store, so the history below can be replayed into a preview store, asserted in
// a unit test or driven from a story alike.

/**
 * One telemetry frame's worth of pedal and steering state, in the raw units the
 * sim reports: pedals normalized 0..1 (clutch 1 = pedal up, fully engaged) and
 * the steering wheel angle in radians.
 */
export interface MockInputSample {
  throttle: number;
  brake: number;
  clutch: number;
  brakeAbsActive: boolean;
  steeringWheelAngle: number;
}

const DEFAULT_SAMPLE_COUNT = 360; // ~6 s at 60 Hz — the longest history window

// One corner spans the whole buffer, so whatever length a consumer asks for it
// sees the same shape: the phases are fractions of the buffer, not sample
// counts. Each boundary is where the next phase begins.
const STRAIGHT_END = 0.15;
const BRAKING_END = 0.35;
const TRAIL_BRAKING_END = 0.55;
const APEX_END = 0.65;

const PEAK_BRAKE = 1;
const TRAIL_BRAKE_RELEASE = 0.12;
const TRAIL_RELEASE_END = 0.8;
const APEX_THROTTLE = 0.32;
const FULL_THROTTLE = 1;

// A right-hander at a lock of 900°: well inside the range the wheel can reach,
// and enough angle for the steering trace to have a visible arc.
export const MOCK_STEERING_PEAK_RAD = 2.4;
const STRAIGHT_STEERING_RAD = 0.06;

// ABS releases pressure in short bursts, and only while the pedal is loaded
// enough to lock a wheel — so the chatter is gated on the pressure itself
// rather than on the phase.
const ABS_MIN_BRAKE = 0.6;
const ABS_PERIOD_SAMPLES = 4;
const ABS_PRESSURE_DROP = 0.08;

// A single downshift under braking: the clutch is the only channel that leaves
// its resting value outside the corner's own phases.
const CLUTCH_DIP_START = 0.45;
const CLUTCH_DIP_END = 0.6;
const CLUTCH_DEPRESSED = 0.05;
const CLUTCH_ENGAGED = 1;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// How far through a phase a sample sits, 0 at its start and 1 at its end.
const phaseProgress = (progress: number, start: number, end: number): number =>
  clamp01((progress - start) / (end - start));

const lerp = (from: number, to: number, ratio: number): number =>
  from + (to - from) * ratio;

// Eases both ends, which is what a pedal pressed by a foot looks like next to a
// straight ramp.
const smoothStep = (ratio: number): number => ratio * ratio * (3 - 2 * ratio);

const brakeAt = (progress: number): number => {
  if (progress < STRAIGHT_END) {
    return 0;
  }

  if (progress < BRAKING_END) {
    return lerp(
      0,
      PEAK_BRAKE,
      smoothStep(phaseProgress(progress, STRAIGHT_END, BRAKING_END))
    );
  }

  if (progress < TRAIL_BRAKING_END) {
    // Released down to a light trailing pressure over most of the phase, then
    // off the pedal entirely before the throttle picks up at the apex.
    const released = phaseProgress(progress, BRAKING_END, TRAIL_BRAKING_END);

    return released < TRAIL_RELEASE_END
      ? lerp(PEAK_BRAKE, TRAIL_BRAKE_RELEASE, released / TRAIL_RELEASE_END)
      : lerp(
          TRAIL_BRAKE_RELEASE,
          0,
          phaseProgress(released, TRAIL_RELEASE_END, 1)
        );
  }

  return 0;
};

const throttleAt = (progress: number): number => {
  if (progress < STRAIGHT_END) {
    return FULL_THROTTLE;
  }

  if (progress < TRAIL_BRAKING_END) {
    return 0;
  }

  if (progress < APEX_END) {
    return lerp(
      0,
      APEX_THROTTLE,
      phaseProgress(progress, TRAIL_BRAKING_END, APEX_END)
    );
  }

  return lerp(
    APEX_THROTTLE,
    FULL_THROTTLE,
    smoothStep(phaseProgress(progress, APEX_END, 1))
  );
};

// Steering builds as the brake comes off — the trail-braking phase is the one
// where both channels are meaningfully open at once — holds through the apex
// and unwinds as the throttle goes down.
const steeringAt = (progress: number): number => {
  if (progress < STRAIGHT_END) {
    return STRAIGHT_STEERING_RAD;
  }

  if (progress < TRAIL_BRAKING_END) {
    return lerp(
      STRAIGHT_STEERING_RAD,
      MOCK_STEERING_PEAK_RAD,
      smoothStep(phaseProgress(progress, STRAIGHT_END, TRAIL_BRAKING_END))
    );
  }

  if (progress < APEX_END) {
    return MOCK_STEERING_PEAK_RAD;
  }

  return lerp(
    MOCK_STEERING_PEAK_RAD,
    STRAIGHT_STEERING_RAD,
    smoothStep(phaseProgress(progress, APEX_END, 1))
  );
};

const clutchAt = (progress: number): number => {
  const brakingProgress = phaseProgress(progress, STRAIGHT_END, BRAKING_END);
  const isDownshifting =
    progress >= STRAIGHT_END &&
    progress < BRAKING_END &&
    brakingProgress >= CLUTCH_DIP_START &&
    brakingProgress < CLUTCH_DIP_END;

  return isDownshifting ? CLUTCH_DEPRESSED : CLUTCH_ENGAGED;
};

/**
 * A believable corner as a channel history: full throttle on the straight, a
 * braking ramp into ABS chatter, the brake trailed off as steering builds, a
 * held apex, then throttle fed back in as the wheel unwinds.
 *
 * The whole corner spans the buffer, so a shorter history is the same shape at
 * a coarser resolution rather than a truncated one.
 */
export const mockInputHistory = (
  sampleCount: number = DEFAULT_SAMPLE_COUNT
): MockInputSample[] => {
  const samples: MockInputSample[] = [];

  for (let index = 0; index < sampleCount; index++) {
    const progress = sampleCount <= 1 ? 0 : index / (sampleCount - 1);
    const brake = brakeAt(progress);

    const brakeAbsActive =
      brake >= ABS_MIN_BRAKE && index % ABS_PERIOD_SAMPLES === 0;

    samples.push({
      throttle: clamp01(throttleAt(progress)),
      brake: clamp01(brakeAbsActive ? brake - ABS_PRESSURE_DROP : brake),
      clutch: clamp01(clutchAt(progress)),
      brakeAbsActive,
      steeringWheelAngle: steeringAt(progress),
    });
  }

  return samples;
};
