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
