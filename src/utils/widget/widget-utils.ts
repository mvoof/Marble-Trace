import { TrackSurface as TrackSurfaceType } from '../../types/bindings';
import { TrackSurface } from '../../types';

// ─── Track surface constants ───────────────────────────────────────────────

export const TRACK_SURFACE_OFF_TRACK: TrackSurfaceType = TrackSurface.OffTrack;
export const TRACK_SURFACE_IN_PIT_STALL: TrackSurfaceType =
  TrackSurface.InPitStall;
export const TRACK_SURFACE_ON_TRACK: TrackSurfaceType = TrackSurface.OnTrack;
export const NEAR_DQ_INCIDENT_THRESHOLD = 15;

// ─── Trend sampling ───────────────────────────────────────────────────────

export const TREND_SAMPLE_INTERVAL_MS = 2000;

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
