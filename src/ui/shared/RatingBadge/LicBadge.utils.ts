import type { LicBadgeStyle } from '@/types/widget-settings';

export const formatIr = (ir: number, abbreviate = true): string => {
  if (abbreviate && ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return String(ir);
};

// Width the SR column needs at scale 1, per the way the value is written. The
// chip styles carry two padded halves; the plain number carries none, so it
// gives the table back the room the chip spent on its own background.
const LIC_COLUMN_PX = {
  badge: { withLetter: 60, ratingOnly: 42 },
  // The badge's capsule with a darker rating half — the same width.
  dark: { withLetter: 60, ratingOnly: 42 },
  plain: { withLetter: 48, ratingOnly: 34 },
} as const;

/**
 * Shared by Standings and Relative, which keep their SR columns the same width
 * so the two tables line up when stacked.
 */
export const licColumnWidthPx = (
  style: LicBadgeStyle | undefined,
  showLetter: boolean
): number => {
  const widths = LIC_COLUMN_PX[style ?? 'badge'] ?? LIC_COLUMN_PX.badge;

  return showLetter ? widths.withLetter : widths.ratingOnly;
};
