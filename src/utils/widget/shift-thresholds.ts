import { telemetryStore } from '@store/iracing/telemetry.store';

export const computeShiftThresholds = () => {
  const { driverInfo } = telemetryStore;

  const slShiftArray = telemetryStore.carStatus?.player_car_sl_shift_rpm ?? [];
  const slBlinkArray = telemetryStore.carStatus?.player_car_sl_blink_rpm ?? [];

  const redLine = driverInfo?.DriverCarRedLine || 10000;

  const yamlShiftRpm = driverInfo?.DriverCarSLShiftRPM || redLine * 0.9;
  const rawYamlBlinkRpm = driverInfo?.DriverCarSLBlinkRPM || redLine;
  const yamlBlinkRpm =
    rawYamlBlinkRpm <= redLine ? rawYamlBlinkRpm : yamlShiftRpm;

  const shiftRpm = slShiftArray[0] ?? yamlShiftRpm;
  const rawBlinkRpm = slBlinkArray[0] ?? yamlBlinkRpm;

  let blinkRpm = rawBlinkRpm;

  if (redLine < rawBlinkRpm) {
    blinkRpm = redLine < shiftRpm ? redLine : shiftRpm;
  }

  return { shiftRpm, blinkRpm };
};
