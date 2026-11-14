/**
 * The strip's columns in their shipped order. The settings hold the user's
 * order of these names (`columnOrder`); widths and groups are in
 * `relative-utils`. Its own module so both of those can import it without
 * importing each other.
 */
export const RELATIVE_COLUMNS = [
  'pos',
  'carNumber',
  'countryFlag',
  'name',
  'sr',
  'ir',
  'gap',
  'distance',
] as const;

export type RelativeColumn = (typeof RELATIVE_COLUMNS)[number];
