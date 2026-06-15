import { TrackSurface as TrackSurfaceType } from '@/types/bindings';
import { TrackSurface } from '@/types';

// ─── Track surface constants ───────────────────────────────────────────────

export const TRACK_SURFACE_OFF_TRACK: TrackSurfaceType = TrackSurface.OffTrack;
export const TRACK_SURFACE_IN_PIT_STALL: TrackSurfaceType =
  TrackSurface.InPitStall;
export const TRACK_SURFACE_ON_TRACK: TrackSurfaceType = TrackSurface.OnTrack;
export const NEAR_DQ_INCIDENT_THRESHOLD = 15;

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

// ─── Status color constants matching SCSS tokens in _widget-tokens.scss ─────

const COLOR_STATUS_INFO = '#60a5fa'; // $widget-status-info (Blue)
const COLOR_STATUS_WARNING = '#fbbf24'; // $widget-status-warning (Amber/Yellow)
const COLOR_STATUS_CAUTION = '#f97316'; // $widget-status-caution/warning (Orange)
const COLOR_STATUS_DANGER = '#ef4444'; // $widget-status-danger (Red)

export const getAirTempColor = (celsius: number): string => {
  if (celsius < 20) return COLOR_STATUS_INFO;
  if (celsius < 28) return COLOR_STATUS_WARNING;
  return COLOR_STATUS_DANGER;
};

export const getTrackTempColor = (celsius: number): string => {
  if (celsius < 30) return COLOR_STATUS_INFO;
  if (celsius < 40) return COLOR_STATUS_CAUTION;
  return COLOR_STATUS_DANGER;
};

export const formatCarNumber = (carNumber: string): string => {
  return carNumber.length === 1 && /^\d$/.test(carNumber)
    ? `0${carNumber}`
    : carNumber;
};
