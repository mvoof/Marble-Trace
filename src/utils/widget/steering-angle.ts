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
 * Wraps an angle into (-180, 180] — a marker riding a circle passes the same
 * point every full turn, the way a marker on a real wheel's rim does.
 */
export const wrapToHalfTurn = (deg: number): number => {
  const wrapped =
    (((deg + HALF_TURN_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;

  return wrapped - HALF_TURN_DEG;
};
