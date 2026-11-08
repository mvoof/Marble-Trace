import type { StatChipTone } from './StatChip';

export const formatIr = (ir: number, abbreviate = true): string => {
  if (abbreviate && ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return String(ir);
};

/** What the rating chip shows of the safety rating. */
export type RatingChipSr = 'none' | 'withLetter' | 'ratingOnly';

/** What the rating chip shows of the iRating. */
export type RatingChipIr = 'none' | 'abbreviated' | 'full';

// The rating chip's parts at scale 1, measured from `StatChip`'s CSS: the rating's lead, the iRating's half, and the 1px edge on
// either side. Change the chip's padding, font or digit widths and these move
// with it — the table columns are sized from them.
const SR_PART_PX: Record<RatingChipSr, number> = {
  none: 0,
  withLetter: 57,
  ratingOnly: 45,
};
const IR_PART_PX: Record<RatingChipIr, number> = {
  none: 0,
  abbreviated: 41,
  full: 47,
};
const CHIP_EDGE_PX = 2;

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

/**
 * The rating chip's width at scale 1 — the column holding it is this plus its
 * own padding, so switching a format grows or shrinks the column by exactly
 * what the chip gained or lost, and the padding never moves. Shared by
 * Standings and Relative, which keep their rating columns the same width so the
 * two tables line up when stacked.
 */
export const ratingChipWidthPx = (sr: RatingChipSr, ir: RatingChipIr): number =>
  SR_PART_PX[sr] + IR_PART_PX[ir] + CHIP_EDGE_PX;

/** The characters the iRating half always holds: "9.9k", or "12345". */
export const iRatingChars = (abbreviate: boolean): number =>
  abbreviate ? 4 : 5;

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
