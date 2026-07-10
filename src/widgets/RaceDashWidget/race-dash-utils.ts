import type { CarStatusFrame, SessionSnapshot } from '@/types/bindings';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { computeShiftThresholds } from '@utils/widget/shift-thresholds';
import { rpmSubZoneForPct } from '@utils/widget/rpm-zone';

export type RpmZone = 'low' | 'mid' | 'high' | 'shift' | 'blink';

/** Below this |delta| (km/h or mph) the player is treated as on-pace with the reference. */
export const COACH_DELTA_DEADZONE = 1;

export interface RpmZoneState {
  /** RPM as a fraction of redline, clamped to 0..1 — the ring's full scale. */
  pct: number;
  zone: RpmZone;
}

export const computeRpmZoneState = (
  rpm: number,
  sessionInfo: SessionSnapshot | null,
  carStatus: CarStatusFrame | null,
  gear: number
): RpmZoneState => {
  const { shiftRpm, blinkRpm, redLine } = computeShiftThresholds(
    sessionInfo,
    carStatus,
    gear
  );
  const pct = Math.min(Math.max(rpm / (redLine || 1), 0), 1);

  if (rpm >= blinkRpm) {
    return { pct, zone: 'blink' };
  }

  if (rpm >= shiftRpm) {
    return { pct, zone: 'shift' };
  }

  // Same scale as RpmLightsWidget (fraction of blinkRpm, not redline) so the
  // low/mid/high bands line up with that widget's zone coloring.
  const zonePct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);
  const subZone = rpmSubZoneForPct(zonePct);

  return { pct, zone: subZone === 'limit' ? 'high' : subZone };
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
    return settings.rpmColorHigh;
  }

  if (zone === 'mid') {
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
    return settings.rpmColorHigh;
  }

  return null;
};
