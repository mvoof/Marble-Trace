import type { CarStatusFrame, SessionSnapshot } from '@/types/bindings';

export interface RpmZoneColors {
  low: string;
  mid: string;
  high: string;
  limit: string;
}

const HIGH_ZONE_PCT = 0.7;
const MID_ZONE_PCT = 0.35;

export type RpmSubZone = 'low' | 'mid' | 'high' | 'limit';

/** Maps a 0..1 fraction of blinkRpm to a sub-zone — shared by RpmLightsWidget's
 * per-LED gradient and RaceDash's low/mid/high ring zones. */
export const rpmSubZoneForPct = (pct: number): RpmSubZone => {
  if (pct >= 1) {
    return 'limit';
  }

  if (pct >= HIGH_ZONE_PCT) {
    return 'high';
  }

  if (pct >= MID_ZONE_PCT) {
    return 'mid';
  }

  return 'low';
};

export const rpmZoneColorByPct = (pct: number, colors: RpmZoneColors): string =>
  colors[rpmSubZoneForPct(pct)];

export const computeShiftThresholds = (
  sessionInfo: SessionSnapshot | null,
  carStatus: CarStatusFrame | null,
  gear: number
) => {
  // These arrays are indexed by gear number (0 = neutral), not car index — a
  // neutral/reverse read is a sentinel (0 or -1), so only trust a positive
  // value for the gear actually engaged.
  const slShiftArray = carStatus?.player_car_sl_shift_rpm ?? [];
  const slBlinkArray = carStatus?.player_car_sl_blink_rpm ?? [];
  const gearShiftRpm = slShiftArray[gear];
  const gearBlinkRpm = slBlinkArray[gear];

  const redLine = sessionInfo?.driverCarRedLine || 10000;

  const yamlShiftRpm = sessionInfo?.driverCarSlShiftRpm || redLine * 0.9;
  const rawYamlBlinkRpm = sessionInfo?.driverCarSlBlinkRpm || redLine;
  const yamlBlinkRpm =
    rawYamlBlinkRpm <= redLine ? rawYamlBlinkRpm : yamlShiftRpm;

  const shiftRpm =
    gearShiftRpm && gearShiftRpm > 0 ? gearShiftRpm : yamlShiftRpm;
  const rawBlinkRpm =
    gearBlinkRpm && gearBlinkRpm > 0 ? gearBlinkRpm : yamlBlinkRpm;

  let blinkRpm = rawBlinkRpm;

  if (redLine < rawBlinkRpm) {
    blinkRpm = redLine < shiftRpm ? redLine : shiftRpm;
  }

  return { shiftRpm, blinkRpm, redLine };
};

export type RpmZone = 'low' | 'mid' | 'high' | 'shift' | 'blink';

export interface RpmZoneState {
  /** RPM as a fraction of redline, clamped to 0..1 — the full gauge scale. */
  pct: number;
  zone: RpmZone;
}

/**
 * Which shift zone the engine is in, on the scale both RaceDash and
 * InvisibleDash paint their digits by.
 */
export const computeRpmZoneState = (
  rpm: number,
  sessionInfo: SessionSnapshot | null,
  carStatus: CarStatusFrame | null,
  gear: number
): RpmZoneState => {
  const { shiftRpm, blinkRpm, redLine } = computeShiftThresholds(
    sessionInfo,
    carStatus,
    gear
  );
  const pct = Math.min(Math.max(rpm / (redLine || 1), 0), 1);

  if (rpm >= blinkRpm) {
    return { pct, zone: 'blink' };
  }

  if (rpm >= shiftRpm) {
    return { pct, zone: 'shift' };
  }

  // Same scale as RpmLightsWidget (fraction of blinkRpm, not redline) so the
  // low/mid/high bands line up with that widget's zone coloring.
  const zonePct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);
  const subZone = rpmSubZoneForPct(zonePct);

  return { pct, zone: subZone === 'limit' ? 'high' : subZone };
};

export interface RpmDigitColors {
  high: string;
  shift: string;
  limit: string;
}

/**
 * Tint for a digit driven by the revs. Neutral (null) below the high zone so
 * the readout does not flicker with color during normal driving.
 */
export const rpmZoneDigitColor = (
  zone: RpmZone,
  colors: RpmDigitColors
): string | null => {
  if (zone === 'blink') {
    return colors.limit;
  }

  if (zone === 'shift') {
    return colors.shift;
  }

  if (zone === 'high') {
    return colors.high;
  }

  return null;
};

// Shared steering-angle math. `steering_wheel_angle` arrives in radians and is
// consumed by two widgets with different readings — the input trace normalizes
// it against the driver's lock-to-lock range (app setting `steeringLock`), the
// race dash marker maps it onto the badge rim one-to-one. Both start here so
// the conversion and the lock's meaning stay defined in one place.

const RADIANS_TO_DEGREES = 180 / Math.PI;

const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;

/** Raw `steering_wheel_angle` (radians) as degrees of wheel rotation. */
export const steeringAngleDeg = (radians: number): number =>
  radians * RADIANS_TO_DEGREES;

/**
 * Wheel angle as a -1..1 fraction of half the lock-to-lock range, so ±1 is
 * full lock. `zoom` shrinks the range the graph covers.
 */
export const normalizedSteering = (
  radians: number,
  steeringLockDeg: number,
  zoom = 1
): number => {
  const halfLockDeg = steeringLockDeg / 2 / zoom;
  const fraction = steeringAngleDeg(radians) / (halfLockDeg || 1);

  return Math.min(Math.max(fraction, -1), 1);
};

/**
 * Wraps an angle into [-180, 180) — a marker riding a circle passes the same
 * point every full turn, the way a marker on a real wheel's rim does.
 */
export const wrapToHalfTurn = (deg: number): number => {
  const wrapped =
    (((deg + HALF_TURN_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;

  return wrapped - HALF_TURN_DEG;
};
