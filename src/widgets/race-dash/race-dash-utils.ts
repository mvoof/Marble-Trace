import type { RpmZone } from '@shared/lib/car-signals';
import { rpmZoneDigitColor } from '@shared/lib/car-signals';
import type { RaceDashWidgetSettings } from './settings-schema';
import type { BlinkCycle } from '@shared/hooks/useBlink';

/** At the redline the gear and the rev number flash together, 500 ms a side. */
export const REDLINE_BLINK: BlinkCycle = { stepMs: 500, steps: 2 };

export type { RpmZone, RpmZoneState } from '@shared/lib/car-signals';
export { computeRpmZoneState } from '@shared/lib/car-signals';

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

// Bands of the field the P-number is tinted by. Each is an upper bound, so a
// position is colored by the first band it fits into.
const POSITION_BAND_WINNER = 1;
const POSITION_BAND_PODIUM = 3;
const POSITION_BAND_TOP5 = 5;
const POSITION_BAND_TOP10 = 10;

/** Tint for the P-number, by which band of the field the player is running in. */
export const positionBandColor = (
  position: number | null,
  settings: RaceDashWidgetSettings
): string | null => {
  if (!settings.colorizePosition || position === null) {
    return null;
  }

  if (position <= POSITION_BAND_WINNER) {
    return settings.positionColorP1;
  }

  if (position <= POSITION_BAND_PODIUM) {
    return settings.positionColorTop3;
  }

  if (position <= POSITION_BAND_TOP5) {
    return settings.positionColorTop5;
  }

  if (position <= POSITION_BAND_TOP10) {
    return settings.positionColorTop10;
  }

  return settings.positionColorRest;
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

  return rpmZoneDigitColor(zone, {
    high: settings.rpmColorHigh,
    shift: settings.rpmColorShift,
    limit: settings.rpmColorLimit,
  });
};

// The plate as shipped: see the breakdown in manifest.ts.
const RACE_DASH_BASE_PX = 418;
// The corner speeds column (ws(28), StatsStrip.module.scss) and the column gap
// in front of it (ws(12)).
const CORNER_SPEEDS_PX = 40;

/** The plate's design width for the cells the settings show. */
export const computeRaceDashDesignWidth = (
  settings: Pick<RaceDashWidgetSettings, 'showCornerSpeeds'>
): number =>
  settings.showCornerSpeeds
    ? RACE_DASH_BASE_PX + CORNER_SPEEDS_PX
    : RACE_DASH_BASE_PX;
