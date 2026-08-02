import type { CarStatusFrame, SessionSnapshot } from '@/types/bindings';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { computeShiftThresholds } from '@utils/widget/shift-thresholds';
import { rpmSubZoneForPct } from '@utils/widget/rpm-zone';

export type RpmZone = 'low' | 'mid' | 'high' | 'shift' | 'blink';

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

// Ramp endpoints for the pit limit digit: amber while there is room left,
// red once the limit is reached. Same hexes as $race-amber / $race-red.
const LIMIT_CALM_RGB: [number, number, number] = [245, 158, 11];
const LIMIT_ALERT_RGB: [number, number, number] = [239, 68, 68];
// The digit starts reacting this many times the near-limit warning delta below
// the limit, so the growth is a slow approach cue rather than a late jump.
const LIMIT_APPROACH_WINDOW_MULT = 4;
// Reads from the corner of the eye at the limit while still fitting the row.
const LIMIT_MAX_SCALE = 1.45;

export interface PitLimitEmphasis {
  color: string;
  scale: number;
}

/**
 * How loudly the pit speed limit digit reads: it warms from amber to red and
 * grows slightly as the car closes on the limit, and sits at full alert once
 * the limit is exceeded.
 */
export const pitLimitEmphasis = (
  speed: number,
  limit: number,
  nearLimitDelta: number
): PitLimitEmphasis => {
  const window = Math.max(nearLimitDelta * LIMIT_APPROACH_WINDOW_MULT, 1);
  const approach = Math.min(Math.max(1 - (limit - speed) / window, 0), 1);

  const channel = (index: number): number =>
    Math.round(
      LIMIT_CALM_RGB[index] +
        (LIMIT_ALERT_RGB[index] - LIMIT_CALM_RGB[index]) * approach
    );

  return {
    color: `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`,
    scale: 1 + (LIMIT_MAX_SCALE - 1) * approach,
  };
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
