import { QUALIFYING_VISIBILITY } from '@shared/contracts/widget-choices';
import {
  bool,
  choice,
  color,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';
import {
  NAME_COLUMN_DEFAULT_PX,
  NAME_COLUMN_MAX_PX,
  NAME_COLUMN_MIN_PX,
} from './close-battle-utils';

export const BATTLE_TRIGGER = ['gap', 'distance'] as const;
export type BattleTrigger = (typeof BATTLE_TRIGGER)[number];

export const BATTLE_SIDES = ['both', 'ahead', 'behind'] as const;
export type BattleSides = (typeof BATTLE_SIDES)[number];

export const BATTLE_OTHER_CLASS = ['show', 'dim', 'hide'] as const;
export type BattleOtherClass = (typeof BATTLE_OTHER_CLASS)[number];

/** How much of the opponent's name the plate spends its width on. */
export const BATTLE_NAME_MODE = ['surname', 'initial', 'full'] as const;
export type BattleNameMode = (typeof BATTLE_NAME_MODE)[number];

/**
 * Every column on the plate is optional except the number, the name and the
 * gap, and the plate spans the widget — so each of these takes the widget's
 * width with it, and `resolveLayoutChange` watches them.
 */
const COLUMNS = {
  showClassBadge: bool(true),
  /**
   * The make, abbreviated the way Standings abbreviates it — "MER", "POR".
   * Worth its column in a multi-make class and pure noise in a one-make one.
   */
  showBrand: bool(false),
  showDistance: bool(true),
  /**
   * The whole laps between you and the car, as `1L` beside the gap. Off in a
   * sprint, where nobody is ever a lap apart and the column is pure width.
   */
  showLapGap: bool(true),
  nameMode: choice(BATTLE_NAME_MODE, 'initial'),
  /**
   * Width of the name column in pixels at the widget's design scale. The plate
   * is exactly as wide as its columns, so narrowing the name narrows the whole
   * plate instead of shrinking the text.
   */
  nameColumnWidth: num(
    NAME_COLUMN_DEFAULT_PX,
    { min: NAME_COLUMN_MIN_PX, max: NAME_COLUMN_MAX_PX, step: 5 },
    { label: 'common.nameColumnWidth' }
  ),
} as const;

export const CLOSE_BATTLE_COLUMN_KEYS = Object.keys(COLUMNS) as Array<
  keyof typeof COLUMNS
>;

export const CLOSE_BATTLE_SETTINGS = defineSettings('closeBattle', {
  /** What counts as "close": a gap in seconds, or a real distance in meters. */
  trigger: choice(BATTLE_TRIGGER, 'gap'),
  /**
   * Seconds. Kept apart from the distance threshold so switching the trigger
   * never carries a value into a range where it is invalid.
   */
  gapThreshold: num(2, { min: 0.5, max: 5, step: 0.5 }),
  /**
   * Meters, stored metric whatever the user reads. The radar's own lower
   * bound: below 5 m you are already touching.
   */
  distanceThreshold: num(50, { min: 5, max: 200 }),
  /** Seconds a row stays after the opponent left the threshold. */
  hideDelay: num(3, { min: 0, max: 15, step: 0.5 }),
  sides: choice(BATTLE_SIDES, 'both'),
  /** More than three is a pack, not a battle. */
  maxRows: num(2, { min: 1, max: 3, step: 1 }),
  showTicks: bool(true),
  /** The meters printed on the ticks. Off leaves the marks and drops the digits. */
  showTickLabels: bool(true),
  /** Axis only: no plates, no names, no numbers. */
  compactMode: bool(false),
  ...COLUMNS,
  /**
   * Cars that land in the same spot on the axis are drawn as one plate with a
   * `+N` badge instead of shoving each other aside.
   */
  mergeOverlapping: bool(true),
  /**
   * How close two cars must be, in meters, to share a plate. A car length or
   * two: at that range they are genuinely side by side, and the axis has
   * nothing left to separate them with.
   */
  mergeDistance: num(2, { min: 0.5, max: 10, step: 0.5 }),
  /** Nothing to fight on pit road, so the widget leaves while you are on it. */
  hideInPits: bool(true),
  /**
   * Same rule as the radar and the track map: `auto` blanks the widget in solo
   * qualifying, where the cars it would name are not on track with you.
   */
  qualifyingVisibility: choice(QUALIFYING_VISIBILITY, 'auto', {
    label: 'common.qualifyingVisibility',
  }),
  /**
   * Opacity of the plate itself. Opaque by default: a see-through row loses
   * its own edges against a corner. The only other thing that fades a plate is
   * `otherClass: 'dim'`, and that one means something.
   */
  plateOpacity: num(1, { min: 0.3, max: 1, step: 0.05 }),
  /** Distant plates shrink, never past a third of their size. */
  scaleByDistance: bool(true),
  otherClass: choice(BATTLE_OTHER_CLASS, 'dim'),
  /** Meters at which the glow starts to build (0 = no glow). */
  glowRange: num(30, { min: 0, max: 100, step: 5 }),
  /**
   * The dashed distance axis and its ticks. Off leaves the plates, the glow and
   * the player line alone on the screen — the axis is scenery, not data.
   */
  showAxis: bool(true),
  /** The horizontal line marking the player, at the centre of the axis. */
  showPlayerLine: bool(true),
  /** White: the line sits on the widget's own background, whatever that is. */
  playerLineColor: color('#ffffff'),
  raceOnly: bool(true),
});

export type CloseBattleWidgetSettings = SettingsOf<
  typeof CLOSE_BATTLE_SETTINGS.shape
>;
