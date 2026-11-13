/**
 * The table's columns in their shipped order. The settings hold the user's
 * order of these names (`columnOrder`); widths and groups are in
 * `standings-utils`. Its own module so both of those can import it without
 * importing each other.
 */
export const STANDINGS_COLUMNS = [
  'pos',
  'carNumber',
  'posChange',
  'countryFlag',
  'name',
  'sr',
  'ir',
  'irChange',
  'laps',
  'gap',
  'interval',
  'lastLap',
  'lapDelta',
  'bestLap',
  'brand',
  'tire',
] as const;

export type StandingsColumn = (typeof STANDINGS_COLUMNS)[number];
