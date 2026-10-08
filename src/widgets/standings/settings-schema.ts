import {
  LIC_BADGE_STYLE,
  ROW_PADDING,
  STANDINGS_VIEW_MODE,
} from '@shared/contracts/widget-choices';
import {
  bool,
  choice,
  color,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';
import {
  DEFAULT_PLAYER_ACCENT_COLOR,
  DEFAULT_PLAYER_ROW_COLOR,
} from '@widgets/widget-manifest';
import {
  NAME_COLUMN_DEFAULT_PX,
  NAME_COLUMN_MAX_PX,
  NAME_COLUMN_MIN_PX,
} from './standings-utils';

const PLAYER_WINDOW = { min: 0, max: 5, step: 1 };

/**
 * The settings that change the table's width: each one re-measures it, so
 * this list is also what `resolveLayoutChange` watches.
 */
const COLUMNS = {
  /**
   * Width of the driver-name column in design px (before `--wfs`). The column is
   * fixed rather than elastic so the table's total width is the sum of its
   * visible columns: narrowing the name narrows the widget instead of shrinking
   * the text, which dragging the widget's edge would do.
   */
  nameColumnWidth: num(
    NAME_COLUMN_DEFAULT_PX,
    { min: NAME_COLUMN_MIN_PX, max: NAME_COLUMN_MAX_PX, step: 5 },
    { label: 'common.nameColumnWidth' }
  ),
  showPosChange: bool(true),
  /** Driver's profile country flag, in its own column before the name. */
  showCountryFlag: bool(false),
  showBrand: bool(true),
  showTire: bool(true),
  showLicBadge: bool(true),
  /**
   * Spell the license out ("A 4.99") or drop the class letter and keep the
   * safety rating alone ("4.99"). The letter is what the badge's color already
   * says, so dropping it costs the column nothing but its width.
   */
  showLicenseLetter: bool(true),
  licBadgeStyle: choice(LIC_BADGE_STYLE, 'badge', {
    label: 'common.licBadgeStyle',
  }),
  showIRating: bool(true),
  /**
   * Round the iRating to a thousand ("9.9k") instead of spelling it out ("9873").
   * The full value needs a wider column, so this widens the table the way
   * toggling a column does.
   */
  abbreviateIRating: bool(true),
  /** Projected iR change column (Elo-based estimate, not real SDK data). */
  showIrChange: bool(true),
  /** Gap to the leader of the table's current reference (overall or class). */
  showGap: bool(true),
  showLastLap: bool(true),
  showBestLap: bool(true),
  showLapsCompleted: bool(true),
} as const;

export const STANDINGS_COLUMN_KEYS = Object.keys(COLUMNS) as Array<
  keyof typeof COLUMNS
>;

export const STANDINGS_SETTINGS = defineSettings('standings', {
  rowPadding: choice(ROW_PADDING, 'narrow', { label: 'common.rowPadding' }),
  viewMode: choice(STANDINGS_VIEW_MODE, 'all'),
  /** Seconds of inactivity after which a manual scroll returns to the automatic view (0 = keep it). */
  scrollResetSeconds: num(8, { min: 0, max: 30 }),
  ...COLUMNS,
  /** Transient up/down arrow shown in the position cell right after a live position change. */
  showLivePosChange: bool(true),
  /**
   * Drives the position number, the row order of the table, the move animation
   * and its arrows, and which of the two projected iR deltas the ΔiR column reads.
   */
  useLivePositions: bool(true),
  /** Rows shown in front of the player when they no longer fit in the top block (0 = pin the player row only). */
  driversAhead: num(0, PLAYER_WINDOW),
  /** Rows shown behind the player when they no longer fit in the top block. */
  driversBehind: num(0, PLAYER_WINDOW),
  /** Driver rows each class gets in grouped view (0 = split the widget height evenly between classes). */
  groupedRowsPerClass: num(0, { min: 0, max: 30, step: 1 }),
  showColumnHeaders: bool(true),
  showSessionHeader: bool(true),
  /** Session time remaining (or elapsed) in the header, same clock as the Timer widget. */
  showSessionTime: bool(true),
  showWeather: bool(true),
  showSOF: bool(true),
  /**
   * Round the SOF to a thousand ("6.1k") instead of spelling it out ("6148").
   * Applies to the session header and to the per-class headers alike — the same
   * number in two places must not be written two ways.
   */
  abbreviateSof: bool(true),
  showTotalDrivers: bool(true),
  /** Badge marking a car that is on pit road or in its stall. */
  showPitIndicator: bool(true, { label: 'common.showPitIndicator' }),
  /** Player-only pit stop counter (counted on the frontend). */
  showPitStops: bool(true),
  showIncidentsBadge: bool(true),
  abbreviateNames: bool(false),
  showDriverFlags: bool(true),
  /**
   * Drop rows for cars the sim marked as retired or disqualified. The player's own
   * row is always kept, and cars merely sitting in the garage are not affected.
   */
  hideRetiredDrivers: bool(false),
  /**
   * In practice and qualifying, drop rows for cars that have not set a lap yet —
   * the sim lists the whole entry list from the green flag, most of it in the
   * garage. The player's own row is always kept.
   */
  hideDriversWithoutLap: bool(false),
  /**
   * Paint the informational columns — last lap, laps completed, gap, brand and
   * iRating — in the secondary text color, so position, name and best lap keep
   * the row's accent to themselves.
   */
  dimSecondaryColumns: bool(false),
  /** Highlight color for the player's own row. */
  playerRowColor: color(DEFAULT_PLAYER_ROW_COLOR, {
    label: 'common.playerRowColor',
  }),
  /** Color of the player's position number and car number. */
  playerAccentColor: color(DEFAULT_PLAYER_ACCENT_COLOR, {
    label: 'common.playerAccentColor',
  }),
});

export type StandingsWidgetSettings = SettingsOf<
  typeof STANDINGS_SETTINGS.shape
>;
