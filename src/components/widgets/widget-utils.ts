import type { DriverEntry } from '@/types/bindings';
import type { SeparatorEntry } from '@/types/standings';

// ─── Track surface constants ───────────────────────────────────────────────

export const TRACK_SURFACE_OFF_TRACK = 0;
export const TRACK_SURFACE_IN_PIT_STALL = 1;
export const TRACK_SURFACE_ON_TRACK = 3;
export const NEAR_DQ_INCIDENT_THRESHOLD = 15;

// ─── Class label constants ─────────────────────────────────────────────────

export const NO_CLASS_LABEL = 'No Class';
export const NO_CLASS_COLOR = '#888888';

// ─── Trend sampling ───────────────────────────────────────────────────────

export const TREND_SAMPLE_INTERVAL_MS = 2000;

// ─── Formatters ───────────────────────────────────────────────────────────

export const formatIRating = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};

export const formatBrand = (screenName: string): string => {
  if (!screenName) return '';
  const firstWord = screenName.split(' ')[0] ?? screenName;
  return firstWord.slice(0, 3).toUpperCase();
};

// ─── Utilities ────────────────────────────────────────────────────────────

export const isSeparator = (
  entry: DriverEntry | SeparatorEntry
): entry is SeparatorEntry => 'isSeparator' in entry && entry.isSeparator;
