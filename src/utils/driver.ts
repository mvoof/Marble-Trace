import { TrackSurface as TrackSurfaceType } from '@/types/bindings';
import { TrackSurface, type FlagType } from '@/types';

// ─── Track surface constants ───────────────────────────────────────────────

export const TRACK_SURFACE_OFF_TRACK: TrackSurfaceType = TrackSurface.OffTrack;
export const TRACK_SURFACE_IN_PIT_STALL: TrackSurfaceType =
  TrackSurface.InPitStall;
export const TRACK_SURFACE_ON_TRACK: TrackSurfaceType = TrackSurface.OnTrack;
export const NEAR_DQ_INCIDENT_THRESHOLD = 15;

/** Incidents left before disqualification at which the counter starts warning. */
const NEAR_DQ_INCIDENT_MARGIN = 2;

/**
 * Whether the incident counter should warn. With a limit reported by the sim the
 * warning tracks it; without one it falls back to the threshold of a default
 * 17x session, which is what most official series run.
 */
export const isNearIncidentLimit = (
  incidents: number,
  incidentLimit: number | null
): boolean => {
  if (incidentLimit === null) {
    return incidents >= NEAR_DQ_INCIDENT_THRESHOLD;
  }

  return incidents >= incidentLimit - NEAR_DQ_INCIDENT_MARGIN;
};

// ─── Formatters ───────────────────────────────────────────────────────────

export const formatIRating = (ir: number): string => {
  if (ir <= 0) return '—';
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};

export const formatBrand = (screenName: string): string => {
  if (!screenName) return '';
  const firstWord = screenName.split(' ')[0] ?? screenName;
  return firstWord.slice(0, 3).toUpperCase();
};

export const abbreviateName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length < 2) return fullName;

  return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
};

export const formatCarNumber = (carNumber: string): string => {
  return carNumber.length === 1 && /^\d$/.test(carNumber)
    ? `0${carNumber}`
    : carNumber;
};

const SESSION_FLAGS = {
  checkered: 0x00000001,
  blue: 0x00000020,
  black: 0x00010000,
  disqualify: 0x00020000,
  repair: 0x00100000,
  furled: 0x00080000,
} as const;

export const parseDriverFlags = (rawFlags: number): FlagType => {
  if (rawFlags & SESSION_FLAGS.disqualify) return 'dq';
  if (rawFlags & SESSION_FLAGS.repair) return 'meatball';
  if (rawFlags & SESSION_FLAGS.black) return 'penalty';
  if (rawFlags & SESSION_FLAGS.furled) return 'black';
  if (rawFlags & SESSION_FLAGS.blue) return 'blue';
  if (rawFlags & SESSION_FLAGS.checkered) return 'checkered';

  return 'none';
};
