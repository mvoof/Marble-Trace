import type { ChassisFrame, ReferenceLapSample } from '@/types/bindings';

/** Minimum separation between two detected corner targets, as a fraction of lap distance. */
const MIN_CORNER_SEPARATION_PCT = 0.02;
/** A local speed minimum must drop at least this much (m/s) from the preceding local max to count as a corner. */
const MIN_SPEED_DROP_MPS = 10 / 3.6;
/** Reference brake input above this is considered "braking" when walking back a braking zone. */
const BRAKE_ON_THRESHOLD = 0.05;
/** Max buckets between a detected apex and the nearest preceding braking sample (covers brake-release-before-apex coasting). */
const MAX_APEX_TO_BRAKE_GAP_BUCKETS = 20;
/**
 * Driver reaction time (s) budgeted into the brake call: the advisory must fire
 * this much *earlier* than the physical last-possible braking point, otherwise
 * by the time the driver reacts the corner is already unmakeable.
 * At 250 km/h (~70 m/s) this moves the call ~28 m earlier.
 */
const REACTION_TIME_S = 0.4;
/**
 * Brake latch release: hold the Brake advisory until current speed is within
 * this factor of the corner's target speed (3% tolerance), so the light stays
 * on for the whole braking zone instead of flickering off the moment the
 * required-distance check stops failing.
 */
const BRAKE_EXIT_SPEED_FACTOR = 1.03;
/**
 * Brake latch release: the apex counts as "passed" once the car is this far
 * beyond it (fraction of lap distance, ~5 buckets) — a safety valve so a latch
 * that never reaches the target speed (e.g. a missed corner) cannot stay lit
 * down the following straight.
 */
const BRAKE_APEX_PASS_MARGIN_PCT = 0.005;
/** Reference throttle above this is considered "at/near full throttle" for the Gas advisory. */
const GAS_THROTTLE_THRESHOLD = 0.95;
/** Current speed must trail the reference by at least this much (m/s) to *enter* a Gas advisory. */
const GAS_SPEED_DEADZONE_MPS = 2.0;
/**
 * Gas latch release: exit only once the speed deficit has closed to this (m/s).
 * Entry needs a 2 m/s deficit, exit needs it nearly closed — the hysteresis gap
 * keeps the light lit across the whole full-throttle section.
 */
const GAS_EXIT_SPEED_DEADZONE_MPS = 0.5;
/** Gas latch release: exit once the reference driver starts lifting below this throttle. */
const GAS_EXIT_THROTTLE = 0.8;
/** Required-brake-distance for the next corner must have at least this much margin vs. remaining distance for Gas. */
const GAS_MARGIN_FACTOR = 1.5;
/** Don't look further ahead than this for the next corner target. */
const MAX_LOOKAHEAD_M = 500;
/** Steering wheel angle divergence from the reference at the same track position beyond which the comparison is considered a different line/phase, not a speed difference. */
const MAX_STEERING_MISMATCH_RAD = 0.35;
/** Lateral acceleration divergence (m/s^2) from the reference at the same track position beyond which the comparison is considered a different line/phase. */
const MAX_LAT_ACCEL_MISMATCH_MPS2 = 4.0;
/** Track wetness (0-7 scale) divergence from the reference lap's recorded wetness beyond which the advisory is suppressed. */
const MAX_WETNESS_MISMATCH = 1;
/** Average tire wear (0.0-1.0) divergence from the reference lap's recorded wear beyond which the advisory is suppressed. */
const MAX_TIRE_WEAR_MISMATCH = 0.15;
/** Fuel level (liters) divergence from the reference lap's recorded fuel beyond which the advisory is suppressed. */
const MAX_FUEL_LEVEL_MISMATCH_L = 20;

export interface CornerTarget {
  /** Apex position as a fraction of lap distance. */
  distPct: number;
  /** Apex (minimum) speed of the reference lap, m/s. */
  targetSpeed: number;
  /** Where the reference driver first applied the brakes for this corner, as a fraction of lap distance. */
  brakeStartPct: number;
  /** Achievable deceleration (m/s^2) derived from this reference lap's own braking zone for this corner. */
  brakingDecel: number;
}

export type DrivingAdvisory = 'brake' | 'gas' | 'neutral';

/**
 * Advisory plus the latch bookkeeping needed to keep it lit across a whole
 * zone. Entry and exit conditions are deliberately different (hysteresis):
 * a Brake advisory latches onto a specific corner and only releases when the
 * target speed is reached or the apex is passed; a Gas advisory releases when
 * the deficit closes or the reference starts lifting.
 */
export interface AdvisoryState {
  advisory: DrivingAdvisory;
  /** Apex `distPct` of the corner the Brake latch is currently held for, or null. */
  brakeCornerPct: number | null;
}

export const NEUTRAL_ADVISORY_STATE: AdvisoryState = {
  advisory: 'neutral',
  brakeCornerPct: null,
};

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

    const brakingZone = deriveBrakingZone(samples, i, trackLengthM);

    if (brakingZone === null) continue;

    targets.push({
      distPct,
      targetSpeed: speed,
      brakeStartPct: brakingZone.brakeStartPct,
      brakingDecel: brakingZone.decel,
    });
    lastTargetDistPct = distPct;
    runningMaxSpeed = speed;
  }

  return targets;
};

interface BrakingZone {
  /** Fraction of lap distance where the reference driver first pressed the brake for this apex. */
  brakeStartPct: number;
  /** Average deceleration over brake-start → apex, m/s^2. */
  decel: number;
}

/**
 * Walk backward from the apex index to find the nearest preceding braking zone
 * (allowing a small coast-out gap between brake release and the true apex) and
 * derive the average deceleration over it from the kinematic relation
 * `v1^2 = v0^2 - 2*a*ds`  →  `a = (v0^2 - v1^2) / (2*ds)`.
 */
const deriveBrakingZone = (
  samples: ReferenceLapSample[],
  apexIndex: number,
  trackLengthM: number
): BrakingZone | null => {
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

  return {
    brakeStartPct: brakeStartIndex / bucketCount,
    decel: (vStart ** 2 - vEnd ** 2) / (2 * deltaDistanceM),
  };
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

/** Average remaining tread (0.0-1.0, 1.0=fresh) across all sampled tire zones, or null when no wear data is available. */
export const getAverageTireWear = (
  chassis: ChassisFrame | null
): number | null => {
  if (!chassis) return null;

  const readings = [
    chassis.lf_wear_l,
    chassis.lf_wear_m,
    chassis.lf_wear_r,
    chassis.rf_wear_l,
    chassis.rf_wear_m,
    chassis.rf_wear_r,
    chassis.lr_wear_l,
    chassis.lr_wear_m,
    chassis.lr_wear_r,
    chassis.rr_wear_l,
    chassis.rr_wear_m,
    chassis.rr_wear_r,
  ].filter((reading): reading is number => reading !== null);

  if (readings.length === 0) return null;

  return readings.reduce((sum, reading) => sum + reading, 0) / readings.length;
};

export interface ConditionMismatchInput {
  currentWetness: number | null;
  recordedWetness: number | null;
  currentTireWear: number | null;
  recordedTireWear: number | null;
  currentFuelLevel: number | null;
  recordedFuelLevel: number | null;
}

/**
 * Whether current session conditions have diverged enough from the reference
 * lap's recorded conditions that comparing braking/throttle points to it is
 * no longer trustworthy (wet vs dry, worn vs fresh tires, heavy vs light fuel load).
 */
export const isConditionMismatch = (input: ConditionMismatchInput): boolean => {
  const {
    currentWetness,
    recordedWetness,
    currentTireWear,
    recordedTireWear,
    currentFuelLevel,
    recordedFuelLevel,
  } = input;

  if (currentWetness !== null && recordedWetness !== null) {
    if (Math.abs(currentWetness - recordedWetness) > MAX_WETNESS_MISMATCH)
      return true;
  }

  if (currentTireWear !== null && recordedTireWear !== null) {
    if (Math.abs(currentTireWear - recordedTireWear) > MAX_TIRE_WEAR_MISMATCH)
      return true;
  }

  if (currentFuelLevel !== null && recordedFuelLevel !== null) {
    if (
      Math.abs(currentFuelLevel - recordedFuelLevel) > MAX_FUEL_LEVEL_MISMATCH_L
    )
      return true;
  }

  return false;
};

/**
 * Whether the current steering/lateral-load state diverges enough from the
 * reference lap at this track position that the two aren't in the same phase
 * of the corner (different line/timing) — makes the speed/throttle comparison unreliable.
 */
const isTrajectoryMismatch = (
  currentSteeringWheelAngle: number,
  referenceSteeringWheelAngleAtCurrent: number | null,
  currentLatAccel: number | null,
  referenceLatAccelAtCurrent: number | null
): boolean => {
  if (referenceSteeringWheelAngleAtCurrent !== null) {
    const steeringDiff = Math.abs(
      currentSteeringWheelAngle - referenceSteeringWheelAngleAtCurrent
    );

    if (steeringDiff > MAX_STEERING_MISMATCH_RAD) return true;
  }

  if (currentLatAccel !== null && referenceLatAccelAtCurrent !== null) {
    const latAccelDiff = Math.abs(currentLatAccel - referenceLatAccelAtCurrent);

    if (latAccelDiff > MAX_LAT_ACCEL_MISMATCH_MPS2) return true;
  }

  return false;
};

export interface DrivingAdvisoryInput {
  currentSpeed: number;
  currentThrottle: number;
  currentDistPct: number;
  trackLengthM: number;
  cornerTargets: CornerTarget[];
  referenceSpeedAtCurrent: number | null;
  referenceThrottleAtCurrent: number | null;
  /** True when ABS is currently intervening — the player is already at max achievable brake, so a Brake call would be wrong. */
  brakeAbsActive: boolean;
  currentSteeringWheelAngle: number;
  referenceSteeringWheelAngleAtCurrent: number | null;
  currentLatAccel: number | null;
  referenceLatAccelAtCurrent: number | null;
}

/**
 * Distance (m) needed to slow from `currentSpeed` to the corner's target speed:
 *
 *   d = (v^2 - v_target^2) / (2*a)  +  v * t_reaction
 *
 * The first term is the kinematic braking distance at the reference lap's own
 * demonstrated deceleration `a`; the second budgets driver reaction time — the
 * distance covered at current speed before the driver actually responds to the
 * light. This margin also absorbs the 10 Hz quantization of `lap_dist_pct`.
 */
const requiredBrakeDistanceM = (
  currentSpeed: number,
  target: CornerTarget
): number => {
  if (currentSpeed <= target.targetSpeed) return 0;

  const kinematicM =
    (currentSpeed ** 2 - target.targetSpeed ** 2) / (2 * target.brakingDecel);

  return kinematicM + currentSpeed * REACTION_TIME_S;
};

/** Whether `distPct` lies inside the reference braking zone `[brakeStartPct, apexPct)`, wrapping around the lap. */
const isInsideBrakingZone = (
  distPct: number,
  target: CornerTarget
): boolean => {
  const zoneLengthPct = pctDistanceAhead(target.brakeStartPct, target.distPct);

  return pctDistanceAhead(target.brakeStartPct, distPct) < zoneLengthPct;
};

/**
 * Zone-latched driving advisory.
 *
 * Brake — enters when the player can no longer shed enough speed by the next
 * apex at the reference driver's own demonstrated deceleration (see
 * `requiredBrakeDistanceM`), or when overspeeding inside the reference braking
 * zone itself. Once latched onto a corner it stays on until the target apex
 * speed is reached (within `BRAKE_EXIT_SPEED_FACTOR`) or the apex is passed —
 * so the light covers the whole braking zone.
 *
 * Gas — enters when under-driving a section the reference took (near) flat out
 * with a ≥`GAS_SPEED_DEADZONE_MPS` deficit; stays on until the deficit closes
 * to `GAS_EXIT_SPEED_DEADZONE_MPS` or the reference starts lifting below
 * `GAS_EXIT_THROTTLE`. The asymmetric enter/exit thresholds are the hysteresis
 * that keeps the light lit across the whole full-throttle section.
 */
export const computeDrivingAdvisory = (
  input: DrivingAdvisoryInput,
  previous: AdvisoryState
): AdvisoryState => {
  const {
    currentSpeed,
    currentThrottle,
    currentDistPct,
    trackLengthM,
    cornerTargets,
    referenceSpeedAtCurrent,
    referenceThrottleAtCurrent,
    brakeAbsActive,
    currentSteeringWheelAngle,
    referenceSteeringWheelAngleAtCurrent,
    currentLatAccel,
    referenceLatAccelAtCurrent,
  } = input;

  if (trackLengthM <= 0) return NEUTRAL_ADVISORY_STATE;

  const trajectoryMismatch = isTrajectoryMismatch(
    currentSteeringWheelAngle,
    referenceSteeringWheelAngleAtCurrent,
    currentLatAccel,
    referenceLatAccelAtCurrent
  );

  const nextTarget = findNextCornerTarget(
    cornerTargets,
    currentDistPct,
    trackLengthM
  );

  if (previous.advisory === 'brake' && previous.brakeCornerPct !== null) {
    const latchedTarget = cornerTargets.find(
      (target) => target.distPct === previous.brakeCornerPct
    );

    // Release the latch only once slowed to the apex target speed or the apex
    // is clearly behind us — this is what keeps the light on for the entire
    // braking zone. "Behind" uses the wrapped lap distance: less than half a
    // lap ahead of the apex but past the small margin means we've crossed it.
    const distancePastApexPct = pctDistanceAhead(
      previous.brakeCornerPct,
      currentDistPct
    );
    const apexPassed =
      distancePastApexPct > BRAKE_APEX_PASS_MARGIN_PCT &&
      distancePastApexPct < 0.5;
    const stillOverspeed =
      latchedTarget !== undefined &&
      currentSpeed > latchedTarget.targetSpeed * BRAKE_EXIT_SPEED_FACTOR;

    if (!apexPassed && stillOverspeed) return previous;
  }

  // A Brake call is valid even on a different line — overspeeding toward an
  // apex must brake regardless — so trajectory mismatch does NOT gate it.
  // ABS intervening means the player is already at max braking; a call would be noise.
  if (!brakeAbsActive && nextTarget && currentSpeed > nextTarget.targetSpeed) {
    const remainingM =
      pctDistanceAhead(currentDistPct, nextTarget.distPct) * trackLengthM;
    const infeasible =
      requiredBrakeDistanceM(currentSpeed, nextTarget) >= remainingM;
    const overspeedInZone = isInsideBrakingZone(currentDistPct, nextTarget);

    if (infeasible || overspeedInZone) {
      return { advisory: 'brake', brakeCornerPct: nextTarget.distPct };
    }
  }

  // Gas compares like-for-like driving states, so a different line/phase
  // (trajectory mismatch) does invalidate it.
  if (
    !trajectoryMismatch &&
    referenceSpeedAtCurrent !== null &&
    referenceThrottleAtCurrent !== null
  ) {
    // Hysteresis: entering needs a real deficit on a (near) flat-out section;
    // once latched, keep advising until the deficit has essentially closed or
    // the reference driver starts lifting for the next corner.
    const gasLatched = previous.advisory === 'gas';
    const deficitMps = gasLatched
      ? GAS_EXIT_SPEED_DEADZONE_MPS
      : GAS_SPEED_DEADZONE_MPS;
    const throttleFloor = gasLatched
      ? GAS_EXIT_THROTTLE
      : GAS_THROTTLE_THRESHOLD;

    const underDriving =
      currentSpeed < referenceSpeedAtCurrent - deficitMps &&
      referenceThrottleAtCurrent >= throttleFloor &&
      currentThrottle < referenceThrottleAtCurrent;

    if (underDriving) {
      if (!nextTarget) return { advisory: 'gas', brakeCornerPct: null };

      // Never advise Gas when the upcoming corner leaves too little braking
      // margin: required distance (with reaction budget) scaled by
      // GAS_MARGIN_FACTOR must still fit into the remaining distance.
      const remainingM =
        pctDistanceAhead(currentDistPct, nextTarget.distPct) * trackLengthM;

      if (
        requiredBrakeDistanceM(currentSpeed, nextTarget) * GAS_MARGIN_FACTOR <
        remainingM
      ) {
        return { advisory: 'gas', brakeCornerPct: null };
      }
    }
  }

  return NEUTRAL_ADVISORY_STATE;
};
