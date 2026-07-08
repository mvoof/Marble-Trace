import type { CarStatusFrame, SessionSnapshot } from '@/types/bindings';

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
