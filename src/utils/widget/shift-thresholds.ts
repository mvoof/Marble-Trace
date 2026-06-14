import type { CarStatusFrame, SessionSnapshot } from '@/types/bindings';

export const computeShiftThresholds = (
  sessionInfo: SessionSnapshot | null,
  carStatus: CarStatusFrame | null
) => {
  const slShiftArray = carStatus?.player_car_sl_shift_rpm ?? [];
  const slBlinkArray = carStatus?.player_car_sl_blink_rpm ?? [];

  const redLine = sessionInfo?.driverCarRedLine || 10000;

  const yamlShiftRpm = sessionInfo?.driverCarSlShiftRpm || redLine * 0.9;
  const rawYamlBlinkRpm = sessionInfo?.driverCarSlBlinkRpm || redLine;
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
