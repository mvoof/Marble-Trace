import { telemetryStore } from '../../../store/iracing/telemetry.store';

const GEAR_REVERSE = -1;

export const useShiftThresholds = () => {
  const { driverInfo } = telemetryStore;
  const gear = telemetryStore.carDynamics?.gear ?? 1;

  // Per-gear telemetry arrays (more accurate than session YAML single values).
  // Falls back to YAML DriverCarSL* when array is unavailable or empty.
  const slShiftArray = telemetryStore.carStatus?.player_car_sl_shift_rpm ?? [];
  const slBlinkArray = telemetryStore.carStatus?.player_car_sl_blink_rpm ?? [];

  const redLine = driverInfo?.DriverCarRedLine || 10000;
  const yamlShiftRpm = driverInfo?.DriverCarSLShiftRPM || redLine * 0.9;
  const rawYamlBlinkRpm = driverInfo?.DriverCarSLBlinkRPM || redLine;
  const yamlBlinkRpm =
    rawYamlBlinkRpm <= redLine ? rawYamlBlinkRpm : yamlShiftRpm;

  const gearIndex = gear === GEAR_REVERSE ? 0 : gear;
  const shiftRpm = slShiftArray[gearIndex] ?? yamlShiftRpm;
  const blinkRpm = slBlinkArray[gearIndex] ?? yamlBlinkRpm;

  return { shiftRpm, blinkRpm };
};
