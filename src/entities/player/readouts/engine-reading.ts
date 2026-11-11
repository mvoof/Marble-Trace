import {
  computeRpmZoneState,
  shiftDigitState,
  type RpmDigitColors,
  type RpmZone,
} from '@shared/lib/car-signals';

import type { SessionStore } from '@entities/session/session.store';

import type { PlayerStore } from '../player.store';

/** How a widget paints a shift digit: the zone colors, and the flash at the shift point. */
export interface ShiftDigitOptions {
  /** The zone colors, or `null` with the colouring off. */
  zoneColors: RpmDigitColors | null;
  blink: boolean;
}

export interface EngineReading {
  rpm: number;
  gear: number;
  /** The revs as a fraction of the shift range. */
  pct: number;
  zone: RpmZone;
  /** The digit's color, or `null` for the widget's own. */
  color: string | null;
  isBlink: boolean;
}

/**
 * The revs, the gear and the zone a shift digit is painted by. Reads hot
 * fields: call it inside a reactive DOM write.
 */
export const readEngine = (
  player: PlayerStore,
  session: SessionStore,
  options: ShiftDigitOptions
): EngineReading => {
  const dynamics = player.carDynamics;
  const rpm = Math.round(dynamics?.rpm ?? 0);
  const gear = dynamics?.gear ?? 0;
  const { pct, zone } = computeRpmZoneState(
    rpm,
    session.sessionInfo,
    player.carStatus,
    gear
  );
  const { color, isBlink } = shiftDigitState(zone, {
    colors: options.zoneColors,
    blink: options.blink,
  });

  return { rpm, gear, pct, zone, color, isBlink };
};
