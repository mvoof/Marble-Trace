import type { CarStatusFrame } from '@/types/bindings';
import { mockFlags } from './flags';

// Mock builders for the engine domain — the liquid temperatures, the pressures
// and the in-car adjustments the engine panel draws. Pure: the builder takes a
// partial override and returns a *complete* frame typed from the generated
// bindings, so a field added to the contract breaks this file rather than
// leaking silently into every fixture. Nothing here touches a store.

/** Where the panel starts flashing the oil cell, in °C. */
export const OIL_TEMP_WARNING_C = 135;

/** Where the panel starts flashing the water cell, in °C. */
export const WATER_TEMP_WARNING_C = 120;

/**
 * A warm engine on a green-flag lap — everything inside its limits, every
 * in-car adjustment on a real setting rather than the zero the recorded
 * snapshot captured before the driver touched anything.
 *
 * The green flag rides along because a status frame carries the race flags:
 * replacing the frame to state an oil temperature would otherwise drop the
 * baseline's flag and blank every flag widget beside the panel.
 */
export const mockCarStatus = (
  overrides: Partial<CarStatusFrame> = {}
): CarStatusFrame => ({
  fuel_level: 46.8,
  fuel_level_pct: 0.52,
  fuel_use_per_hour: 9.4,
  oil_temp: 104,
  oil_press: 412,
  water_temp: 91,
  voltage: 13.8,
  on_pit_road: false,
  is_on_track: true,
  spotter: 'off',
  engine_warnings: 0,
  player_car_sl_shift_rpm: [6690],
  player_car_sl_blink_rpm: [7210],
  flags: mockFlags({ green: true }),
  dc_abs: 6,
  dc_brake_bias: 54.5,
  dc_traction_control: 4,
  dc_throttle_shape: 3,
  ...overrides,
});
