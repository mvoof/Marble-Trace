import type { CarDynamicsFrame } from '@/types/bindings';

// Mock builders for the dynamics domain — the motion of the player's own car:
// how fast it is going, what the engine is doing and how the car is loaded.
// Pure: the builder takes a partial override and returns a *complete* frame
// typed from the generated bindings, so a field added to the contract breaks
// this file rather than leaking silently into every fixture. Nothing here
// touches a store.

/** The conversion every widget states its speed in, and every fixture with it. */
export const MPS_PER_KMH = 3.6;

/** One g in m/s², which is the unit the two accelerometer channels carry. */
export const G_ACCEL_MPS2 = 9.80665;

/**
 * A car mid-corner on a green-flag lap: under power in fourth, a little lateral
 * load on it and the wheel still turned.
 *
 * Everything a widget reads is a real number rather than the nulls a recorded
 * frame may carry — a dash is a state the preview must not default to.
 */
export const mockCarDynamics = (
  overrides: Partial<CarDynamicsFrame> = {}
): CarDynamicsFrame => ({
  speed: 184 / MPS_PER_KMH,
  rpm: 6400,
  gear: 4,
  steering_wheel_angle: 0.12,
  velocity_x: 184 / MPS_PER_KMH,
  velocity_y: 0.4,
  velocity_z: 0,
  lat_accel: 0.8 * G_ACCEL_MPS2,
  long_accel: 0.2 * G_ACCEL_MPS2,
  yaw: 1.14,
  yaw_rate: 0.09,
  pitch: 0.01,
  roll: 0.02,
  shift_indicator_pct: 0.62,
  shift_grind_rpm: 0,
  ...overrides,
});
