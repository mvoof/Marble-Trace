import type { LicBadgeStyle } from '@shared/contracts/widget-choices';

import type { StatChipTone } from './StatChip';

export const formatIr = (ir: number, abbreviate = true): string => {
  if (abbreviate && ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return String(ir);
};

/** What the rating chip shows of the safety rating. */
export type RatingChipSr = 'none' | 'withLetter' | 'ratingOnly';

/** What the rating chip shows of the iRating. */
export type RatingChipIr = 'none' | 'abbreviated' | 'full';

/** What the chip carries, from a table's settings. */
export const ratingChipParts = (settings: {
  showLicBadge: boolean;
  showLicenseLetter: boolean;
  showIRating: boolean;
  abbreviateIRating: boolean;
}): { sr: RatingChipSr; ir: RatingChipIr } => ({
  sr: !settings.showLicBadge
    ? 'none'
    : settings.showLicenseLetter
      ? 'withLetter'
      : 'ratingOnly',
  ir: !settings.showIRating
    ? 'none'
    : settings.abbreviateIRating
      ? 'abbreviated'
      : 'full',
});

// The chip's geometry at scale 1, from `StatChip`'s CSS. Padding and edges
// follow the widget's scale alone; the digits also follow the user's font
// scale, so the two are kept apart and the column grows with the text.
const CHIP_FONT_PX = 11; // fs(xxs)
const MONO_ADVANCE_EM = 0.5498; // Consolas
const SOLID_TRACKING_EM = 0.06; // .leadSolid letter-spacing
const SOLID_LEAD_PAD_PX = 16; // sp(sm) on both sides
const TINT_LEAD_PAD_PX = 12; // sp(xs) on both sides
const VALUE_PAD_PX = 16; // sp(sm) on both sides
const CHIP_EDGE_PX = 2; // 1px on either side

const SR_CHARS: Record<RatingChipSr, number> = {
  none: 0,
  withLetter: 6, // "A 4.99"
  ratingOnly: 4, // "4.99"
};

const IR_CHARS: Record<RatingChipIr, number> = {
  none: 0,
  abbreviated: 4, // "9.9k"
  full: 5, // "12345"
};

/** The characters the iRating half always holds: "9.9k", or "12345". */
export const iRatingChars = (abbreviate: boolean): number =>
  abbreviate ? IR_CHARS.abbreviated : IR_CHARS.full;

/** A chip's width at scale 1, split by what follows the font scale. */
export interface ChipWidth {
  /** Padding and edges — the widget's scale alone. */
  fixedPx: number;
  /** The characters — the widget's scale and the font scale. */
  textPx: number;
}

/** The rating chip's width for the parts it shows and the badge style. */
export const ratingChipWidth = (
  sr: RatingChipSr,
  ir: RatingChipIr,
  badgeStyle: LicBadgeStyle
): ChipWidth => {
  const isSolid = badgeStyle !== 'dark';
  const advancePx = MONO_ADVANCE_EM * CHIP_FONT_PX;
  const srAdvancePx = isSolid
    ? (MONO_ADVANCE_EM + SOLID_TRACKING_EM) * CHIP_FONT_PX
    : advancePx;

  const srPadPx =
    sr === 'none' ? 0 : isSolid ? SOLID_LEAD_PAD_PX : TINT_LEAD_PAD_PX;
  const irPadPx = ir === 'none' ? 0 : VALUE_PAD_PX;

  return {
    fixedPx: srPadPx + irPadPx + CHIP_EDGE_PX,
    textPx: SR_CHARS[sr] * srAdvancePx + IR_CHARS[ir] * advancePx,
  };
};

/**
 * A grid column holding the chip plus `paddingPx` of cell padding, as CSS: it
 * grows with the font scale exactly as the chip does, so the padding around
 * the chip never changes. At font scale 1 it is `columnPx` wide.
 */
export const chipColumnCss = (width: ChipWidth, paddingPx: number): string =>
  `calc(${columnPx(width, paddingPx) - width.textPx}px * var(--wfs, 1) + ${width.textPx}px * var(--wfs, 1) * var(--font-scale, 1))`;

/** A table's settings as its design width reads them: the font scale too. */
export type WithFontScale<Settings> = Settings & { fontScale?: number };

/** The font scale a widget's settings carry, 1 when they carry none. */
export const fontScaleOf = (settings: { fontScale?: unknown }): number =>
  typeof settings.fontScale === 'number' && settings.fontScale > 0
    ? settings.fontScale
    : 1;

/**
 * The same column at the widget's scale 1 and the given font scale, rounded up
 * to a whole pixel — what a table adds up as its design width.
 */
export const columnPx = (
  width: ChipWidth,
  paddingPx: number,
  fontScale = 1
): number => Math.ceil(width.fixedPx + width.textPx * fontScale + paddingPx);

const LICENSE_TONE: Record<string, StatChipTone> = {
  A: 'licenseA',
  B: 'licenseB',
  C: 'licenseC',
  D: 'licenseD',
  R: 'licenseR',
};

const licenseLetter = (licString: string): string =>
  (licString || 'R').charAt(0).toUpperCase();

/** The chip tone of a license class — "A 4.99" is the A tone. */
export const licenseTone = (licString: string): StatChipTone =>
  LICENSE_TONE[licenseLetter(licString)] ?? 'licenseR';

/**
 * The safety rating as the chip writes it: "A 4.99", or "4.99" without the
 * class letter. A license with no rating keeps its letter rather than leaving
 * the colored lead empty.
 */
export const safetyRatingLabel = (
  licString: string,
  showLetter: boolean
): string => {
  const letter = licenseLetter(licString);
  const rating = licString?.slice(1).trim() || '';

  return showLetter || !rating ? `${letter} ${rating}`.trim() : rating;
};
