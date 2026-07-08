import type { CarStatusFrame, SessionSnapshot } from '@/types/bindings';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { computeShiftThresholds } from '@utils/widget/shift-thresholds';

export type RpmZone = 'low' | 'mid' | 'high' | 'shift' | 'blink';

const HIGH_ZONE_PCT = 0.7;
const MID_ZONE_PCT = 0.35;

/** Below this |delta| (km/h or mph) the player is treated as on-pace with the reference. */
export const COACH_DELTA_DEADZONE = 1;

export interface RpmZoneState {
  /** RPM as a fraction of the blink threshold, clamped to 0..1. */
  pct: number;
  zone: RpmZone;
}

export const computeRpmZoneState = (
  rpm: number,
  sessionInfo: SessionSnapshot | null,
  carStatus: CarStatusFrame | null
): RpmZoneState => {
  const { shiftRpm, blinkRpm } = computeShiftThresholds(sessionInfo, carStatus);
  const pct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);

  if (rpm >= blinkRpm) {
    return { pct, zone: 'blink' };
  }

  if (rpm >= shiftRpm) {
    return { pct, zone: 'shift' };
  }

  if (pct >= HIGH_ZONE_PCT) {
    return { pct, zone: 'high' };
  }

  if (pct >= MID_ZONE_PCT) {
    return { pct, zone: 'mid' };
  }

  return { pct, zone: 'low' };
};

/** Color of the dotted RPM fill inside the center panel. */
export const rpmFillColor = (
  zone: RpmZone,
  settings: RaceDashWidgetSettings
): string => {
  if (zone === 'blink') {
    return settings.rpmColorLimit;
  }

  if (zone === 'shift') {
    return settings.rpmColorShift;
  }

  if (zone === 'high') {
    return settings.rpmColorMid;
  }

  return settings.rpmColorLow;
};

/**
 * Tint for the gear digit and RPM number. Neutral (null) below the high zone
 * so the cluster does not flicker with color during normal driving.
 */
export const rpmNumberColor = (
  zone: RpmZone,
  settings: RaceDashWidgetSettings
): string | null => {
  if (!settings.colorizeByRpmZone) {
    return null;
  }

  if (zone === 'blink') {
    return settings.rpmColorLimit;
  }

  if (zone === 'shift') {
    return settings.rpmColorShift;
  }

  if (zone === 'high') {
    return settings.rpmColorMid;
  }

  return null;
};
