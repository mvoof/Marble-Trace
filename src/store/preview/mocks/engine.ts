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
  // Null rather than zero on purpose: this baseline is a GT3, and the adapter
  // clears an adjustment the car never declared so the panel can tell "the car
  // has no such control" from "the control is set to zero".
  dc_traction_control_2: null,
  dc_engine_braking: null,
  dc_brake_bias_fine: null,
  dc_peak_brake_bias: null,
  dc_diff_entry: null,
  dc_diff_middle: null,
  dc_diff_exit: null,
  energy_ers_battery_pct: null,
  power_mgu_k: null,
  energy_battery_to_mgu_k_lap: null,
  dc_mguk_deploy_mode: null,
  drs: null,
  ...overrides,
});

/**
 * A hybrid formula car: every in-car adjustment the GT3 lacks, plus a battery
 * mid-deployment. `dc_mguk_deploy_mode` is a live selector here — on a GTP car
 * it is a constant, which is why the battery widget hides the mode strip rather
 * than drawing a selector the driver cannot move.
 */
export const mockHybridCarStatus = (
  overrides: Partial<CarStatusFrame> = {}
): CarStatusFrame =>
  mockCarStatus({
    dc_abs: null,
    dc_brake_bias: 57,
    dc_traction_control: 5,
    dc_throttle_shape: null,
    dc_traction_control_2: 2,
    dc_engine_braking: 6,
    dc_brake_bias_fine: 0,
    dc_peak_brake_bias: 61,
    dc_diff_entry: 2,
    dc_diff_middle: 5,
    dc_diff_exit: 5,
    energy_ers_battery_pct: 0.9,
    power_mgu_k: 102_556,
    energy_battery_to_mgu_k_lap: 1_940_000,
    dc_mguk_deploy_mode: 1,
    drs: 'Unavailable',
    ...overrides,
  });
