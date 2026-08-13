import type { CSSProperties } from 'react';

const FALLBACK_CLASS_COLOR = '#888888';

/**
 * Normalize a raw iRacing class/licence color string (e.g. "0xffda59" or
 * "ffda59") into a CSS hex color. Falls back to a neutral grey when empty.
 */
export const parseClassColor = (raw: string | null | undefined): string => {
  if (!raw) return FALLBACK_CLASS_COLOR;

  const hex = raw.replace('0x', '').replace('#', '');

  return hex.length >= 6 ? `#${hex.slice(-6)}` : FALLBACK_CLASS_COLOR;
};

const LUMINANCE_MIDPOINT = 0.6;
const CONTRAST_DARK = '#111111';
const CONTRAST_LIGHT = '#ffffff';

/**
 * Pick a legible text color (near-black or white) for a label drawn on top of
 * the given background hex. Uses relative luminance so a bright fill (e.g. the
 * yellow safety-car diamond) gets dark text and a dark fill gets light text.
 */
export const getContrastTextColor = (background: string): string => {
  const hex = parseClassColor(background).slice(1);
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;

  const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;

  return luminance >= LUMINANCE_MIDPOINT ? CONTRAST_DARK : CONTRAST_LIGHT;
};

// Golden angle rotation ensures maximum perceptual distance between consecutive hues
const GOLDEN_ANGLE_DEG = 137.508;

export const getSectorColor = (index: number): string => {
  const hue = (index * GOLDEN_ANGLE_DEG) % 360;

  return `hsl(${hue.toFixed(1)}, 40%, 50%)`;
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

/**
 * Fill for the player's own row in a driver table.
 *
 * Fills with the user-chosen colour and stacks the same colour in a thin band
 * at the top and bottom edges. Layering the colour over the fill makes those
 * edges brighter in the same hue — a glow that reads like a border.
 *
 * Returns undefined for every other driver so the caller can spread it
 * unconditionally.
 */
export const playerRowStyle = (
  isPlayer: boolean,
  playerRowColor: string
): CSSProperties | undefined =>
  isPlayer
    ? {
        background: `linear-gradient(to bottom, ${playerRowColor}, transparent 2px), linear-gradient(to top, ${playerRowColor}, transparent 2px), ${playerRowColor}`,
      }
    : undefined;
