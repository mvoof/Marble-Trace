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
