import type { ReferenceLapSample } from '@/types/bindings';

/** Minimum separation between two detected corner targets, as a fraction of lap distance. */
const MIN_CORNER_SEPARATION_PCT = 0.02;
/** A local speed minimum must drop at least this much (m/s) from the preceding local max to count as a corner. */
const MIN_SPEED_DROP_MPS = 10 / 3.6;
/** Reference brake input above this is considered "braking" when walking back a braking zone. */
const BRAKE_ON_THRESHOLD = 0.05;
/** Max buckets between a detected apex and the nearest preceding braking sample (covers brake-release-before-apex coasting). */
const MAX_APEX_TO_BRAKE_GAP_BUCKETS = 20;
/** Required-brake-distance must be at least this fraction of the remaining distance to trigger a Brake advisory. */
const BRAKE_SAFETY_MARGIN = 0.9;
/** Reference throttle above this is considered "at/near full throttle" for the Gas advisory. */
const GAS_THROTTLE_THRESHOLD = 0.95;
/** Current speed must trail the reference by at least this much (m/s) to consider a Gas advisory. */
const GAS_SPEED_DEADZONE_MPS = 2.0;
/** Required-brake-distance for the next corner must have at least this much margin vs. remaining distance for Gas. */
const GAS_MARGIN_FACTOR = 1.5;
/** Don't look further ahead than this for the next corner target. */
const MAX_LOOKAHEAD_M = 500;

export interface CornerTarget {
  distPct: number;
  targetSpeed: number;
  /** Achievable deceleration (m/s^2) derived from this reference lap's own braking zone for this corner. */
  brakingDecel: number;
}

export type DrivingAdvisory = 'brake' | 'gas' | 'neutral';

/** Distance ahead from `fromPct` to `toPct`, wrapping around the lap, as a `[0, 1)` fraction. */
const pctDistanceAhead = (fromPct: number, toPct: number): number => {
  const diff = toPct - fromPct;
  return diff >= 0 ? diff : diff + 1;
};

/**
 * Scan a completed reference lap's samples for corner apexes (local speed minima)
 * and derive the deceleration actually achieved braking into each one.
 */
export const extractCornerTargets = (
  samples: ReferenceLapSample[],
  trackLengthM: number
): CornerTarget[] => {
  const bucketCount = samples.length;

  if (bucketCount < 3 || trackLengthM <= 0) return [];

  const targets: CornerTarget[] = [];
  let runningMaxSpeed = samples[0].speed;
  let lastTargetDistPct: number | null = null;

  for (let i = 1; i < bucketCount - 1; i++) {
    const speed = samples[i].speed;

    runningMaxSpeed = Math.max(runningMaxSpeed, speed);

    const isLocalMin =
      speed < samples[i - 1].speed && speed <= samples[i + 1].speed;

    if (!isLocalMin) continue;

    const drop = runningMaxSpeed - speed;
    const distPct = i / bucketCount;

    if (drop < MIN_SPEED_DROP_MPS) continue;

    if (
      lastTargetDistPct !== null &&
      pctDistanceAhead(lastTargetDistPct, distPct) < MIN_CORNER_SEPARATION_PCT
    ) {
      continue;
    }

    const brakingDecel = deriveBrakingDecel(samples, i, trackLengthM);

    if (brakingDecel === null) continue;

    targets.push({ distPct, targetSpeed: speed, brakingDecel });
    lastTargetDistPct = distPct;
    runningMaxSpeed = speed;
  }

  return targets;
};

/**
 * Walk backward from the apex index to find the nearest preceding braking zone
 * (allowing a small coast-out gap between brake release and the true apex) and
 * derive `a = (v0^2 - v1^2) / (2*ds)` over it.
 */
const deriveBrakingDecel = (
  samples: ReferenceLapSample[],
  apexIndex: number,
  trackLengthM: number
): number | null => {
  const bucketCount = samples.length;

  let brakeEndIndex = apexIndex;

  while (
    brakeEndIndex > 0 &&
    samples[brakeEndIndex].brake <= BRAKE_ON_THRESHOLD &&
    apexIndex - brakeEndIndex < MAX_APEX_TO_BRAKE_GAP_BUCKETS
  ) {
    brakeEndIndex--;
  }

  if (samples[brakeEndIndex].brake <= BRAKE_ON_THRESHOLD) return null;

  let brakeStartIndex = brakeEndIndex;

  while (
    brakeStartIndex > 0 &&
    samples[brakeStartIndex - 1].brake > BRAKE_ON_THRESHOLD
  ) {
    brakeStartIndex--;
  }

  if (brakeStartIndex === brakeEndIndex) return null;

  const vStart = samples[brakeStartIndex].speed;
  const vEnd = samples[apexIndex].speed;
  const bucketsSpanned = apexIndex - brakeStartIndex;
  const deltaDistanceM = (bucketsSpanned / bucketCount) * trackLengthM;

  if (deltaDistanceM <= 0 || vStart <= vEnd) return null;

  return (vStart ** 2 - vEnd ** 2) / (2 * deltaDistanceM);
};

/** Nearest corner target strictly ahead of `currentDistPct`, within `MAX_LOOKAHEAD_M`. */
export const findNextCornerTarget = (
  cornerTargets: CornerTarget[],
  currentDistPct: number,
  trackLengthM: number
): CornerTarget | null => {
  let nearest: CornerTarget | null = null;
  let nearestDistanceM = Infinity;

  for (const target of cornerTargets) {
    const distanceM =
      pctDistanceAhead(currentDistPct, target.distPct) * trackLengthM;

    if (
      distanceM > 0 &&
      distanceM <= MAX_LOOKAHEAD_M &&
      distanceM < nearestDistanceM
    ) {
      nearest = target;
      nearestDistanceM = distanceM;
    }
  }

  return nearest;
};

export interface DrivingAdvisoryInput {
  currentSpeed: number;
  currentThrottle: number;
  currentDistPct: number;
  trackLengthM: number;
  cornerTargets: CornerTarget[];
  referenceSpeedAtCurrent: number | null;
  referenceThrottleAtCurrent: number | null;
}

/**
 * "Will I make the corner" feasibility check — brakes if the player cannot shed
 * enough speed by the next apex at the reference driver's own demonstrated
 * deceleration; suggests gas if under-driving a section the reference took flat out.
 */
export const computeDrivingAdvisory = (
  input: DrivingAdvisoryInput
): DrivingAdvisory => {
  const {
    currentSpeed,
    currentThrottle,
    currentDistPct,
    trackLengthM,
    cornerTargets,
    referenceSpeedAtCurrent,
    referenceThrottleAtCurrent,
  } = input;

  if (trackLengthM <= 0) return 'neutral';

  const nextTarget = findNextCornerTarget(
    cornerTargets,
    currentDistPct,
    trackLengthM
  );

  if (nextTarget && currentSpeed > nextTarget.targetSpeed) {
    const remainingDistanceM =
      pctDistanceAhead(currentDistPct, nextTarget.distPct) * trackLengthM;
    const requiredBrakeDistanceM =
      (currentSpeed ** 2 - nextTarget.targetSpeed ** 2) /
      (2 * nextTarget.brakingDecel);

    if (requiredBrakeDistanceM >= remainingDistanceM * BRAKE_SAFETY_MARGIN) {
      return 'brake';
    }
  }

  if (
    referenceSpeedAtCurrent !== null &&
    referenceThrottleAtCurrent !== null &&
    currentSpeed < referenceSpeedAtCurrent - GAS_SPEED_DEADZONE_MPS &&
    referenceThrottleAtCurrent >= GAS_THROTTLE_THRESHOLD &&
    currentThrottle < referenceThrottleAtCurrent
  ) {
    if (!nextTarget) return 'gas';

    const remainingDistanceM =
      pctDistanceAhead(currentDistPct, nextTarget.distPct) * trackLengthM;
    const requiredBrakeDistanceM =
      currentSpeed > nextTarget.targetSpeed
        ? (currentSpeed ** 2 - nextTarget.targetSpeed ** 2) /
          (2 * nextTarget.brakingDecel)
        : 0;

    if (requiredBrakeDistanceM * GAS_MARGIN_FACTOR < remainingDistanceM) {
      return 'gas';
    }
  }

  return 'neutral';
};
