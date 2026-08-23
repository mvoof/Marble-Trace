import type { DriverEntry, NearbyCar } from '@/types/bindings';
import type { CloseBattleWidgetSettings } from '@/types/widget-settings';
import { computeRelativeGap } from '@ui/widgets/RelativeWidget/relative-utils';
import { splitDriverName } from '@utils/driver';

/**
 * The axis ends short of the widget edge: the outermost tick label and the
 * plate of a car sitting at the full range have to fit somewhere.
 */
const AXIS_EDGE_INSET_PCT = 9;

/** Half of the axis, in percent of the widget height. */
const AXIS_HALF_PCT = 50 - AXIS_EDGE_INSET_PCT;

/** Percent of the height a tick label eats out of the dashed line. */
export const TICK_GAP_PCT = 4;

/**
 * Distance between two tick labels, keyed by the axis range they sit on — one
 * table per unit, because a tick every 25 m is round and every 82 ft is not.
 * Both are in the unit the label is printed in.
 */
const TICK_STEP_BY_RANGE: Record<number, number> = {
  5: 2,
  10: 5,
  25: 10,
  50: 25,
  100: 25,
  200: 50,
};

const TICK_STEP_BY_RANGE_FEET: Record<number, number> = {
  15: 5,
  30: 10,
  75: 25,
  150: 50,
  300: 100,
  600: 200,
};

const METERS_TO_FEET = 3.28084;

/**
 * Past this much of a lap apart the two cars are no longer racing each other,
 * they are traffic to one another — the same threshold the Relative widget
 * uses to call a car lapped.
 */
const LAPPED_THRESHOLD = 0.5;

/** Whole laps between two cars, `0` while they are on the same one. */
const lapsBetween = (driver: DriverEntry, player: DriverEntry): number => {
  const delta =
    driver.lap + driver.lapDistPct - (player.lap + player.lapDistPct);

  if (Math.abs(delta) < LAPPED_THRESHOLD) {
    return 0;
  }

  return Math.max(1, Math.round(Math.abs(delta)));
};

export interface BattleOpponent {
  carIdx: number;
  /** Positive = ahead, negative = behind (meters). */
  longitudinalDist: number;
  /** Absolute distance in meters. */
  clearance: number;
  /** Relative gap in seconds, Relative-widget convention: ahead negative, behind positive. */
  gapSeconds: number;
  entry: DriverEntry;
  isOtherClass: boolean;
  isAhead: boolean;
  /**
   * Whole laps between this car and the player, unsigned — `0` for anyone on
   * the same lap. Which side of the lap they are on is left to the axis: a
   * plate above the player line is ahead and one below is behind, said louder
   * by its position than any sign could, and a sign here would have to
   * contradict the gap column, where ahead reads negative.
   */
  lapsApart: number;
}

/** A dashed piece of the axis line, so a tick label never sits on the dashes. */
export interface AxisSegment {
  topPct: number;
  heightPct: number;
}

export interface AxisTick {
  topPct: number;
  /** What the label prints: meters or feet, matching the unit setting. */
  label: number;
}

/** Meters into the unit the widget prints, and back. */
export const toDisplayDistance = (meters: number, isMetric: boolean): number =>
  isMetric ? meters : meters * METERS_TO_FEET;

export const toMeters = (display: number, isMetric: boolean): number =>
  isMetric ? display : display / METERS_TO_FEET;

/**
 * The ticks, laid out in the unit they are read in. The axis itself stays in
 * meters — everything the sim reports is — so a tick is placed by its metric
 * position and labeled by its imperial value.
 */
export const axisTicks = (axisRange: number, isMetric: boolean): AxisTick[] => {
  const range = Math.round(toDisplayDistance(axisRange, isMetric));
  const table = isMetric ? TICK_STEP_BY_RANGE : TICK_STEP_BY_RANGE_FEET;
  const step = table[range] ?? range / 2;
  const ticks: AxisTick[] = [];

  for (let label = step; label <= range; label += step) {
    const meters = toMeters(label, isMetric);

    ticks.push({ topPct: distanceToTopPct(meters, axisRange), label });
    ticks.push({ topPct: distanceToTopPct(-meters, axisRange), label });
  }

  return ticks.sort((first, second) => first.topPct - second.topPct);
};

/**
 * The dashed line is drawn as pieces rather than one gradient: a label sitting
 * on top of the dashes is unreadable at a glance, which is the only speed the
 * widget is read at.
 */
export const buildAxisSegments = (ticks: AxisTick[]): AxisSegment[] => {
  const holes = ticks
    .map((tick) => ({
      from: tick.topPct - TICK_GAP_PCT / 2,
      to: tick.topPct + TICK_GAP_PCT / 2,
    }))
    .sort((first, second) => first.from - second.from);

  const segments: AxisSegment[] = [];
  let cursor = 0;

  for (const hole of holes) {
    const height = hole.from - cursor;

    if (height > 0) {
      segments.push({ topPct: cursor, heightPct: height });
    }

    cursor = Math.max(cursor, hole.to);
  }

  if (cursor < 100) {
    segments.push({ topPct: cursor, heightPct: 100 - cursor });
  }

  return segments;
};

/** Ahead goes up, behind goes down — the reading order of the Relative widget. */
export const distanceToTopPct = (
  longitudinalDist: number,
  axisRange: number
): number => {
  const ratio = Math.max(-1, Math.min(1, longitudinalDist / axisRange));

  return 50 - ratio * AXIS_HALF_PCT;
};

/**
 * A plate is ws(40) tall on a 420 px design height — a hair under a tenth of
 * the axis. Two cars metres apart would otherwise draw on top of each other.
 */
export const PLATE_SLOT_PCT = 11;

/** The two thresholds are stored apart; this picks the one in force. */
export const activeThreshold = (settings: CloseBattleWidgetSettings): number =>
  settings.trigger === 'distance'
    ? settings.distanceThreshold
    : settings.gapThreshold;

/** One drawn plate: the nearest car of the group, and whoever it stands for. */
export interface BattlePlateGroup {
  /** Stable across ticks while the group keeps its cars — the React key. */
  key: number;
  leader: BattleOpponent;
  /** Cars sharing the leader's spot on the axis, nearest first. */
  merged: BattleOpponent[];
  topPct: number;
}

/**
 * How far apart two cars must drift before a merged pair is split again.
 *
 * Cars in a fight cross the merge threshold constantly, and a plate that merges
 * and splits every tenth of a second is unreadable. Once merged, they stay
 * merged until they are clearly apart.
 */
const SPLIT_HYSTERESIS = 1.6;

/**
 * Which plates are drawn, and where.
 *
 * The axis is honest about distance, but two cars a metre apart map to the same
 * spot. Merging is the honest answer: one plate carrying both drivers, because
 * two plates shoved apart claim a gap that is not there. With merging off they
 * are pushed apart instead, nearest car first — the one in your mirrors keeps
 * its true position, the others give way.
 *
 * `mergeDistance` is that "same spot" in meters — a car length or two, set by
 * the user. `held` is the set of cars that were merged into some plate on the
 * previous tick; they get the wider split threshold, which is what stops the
 * plate from flickering while the two cars trade a metre back and forth.
 *
 * Either way a plate is clamped inside the widget, so the outermost one never
 * hangs off the edge.
 */
export const buildPlateGroups = (
  opponents: BattleOpponent[],
  axisRange: number,
  mergeOverlapping: boolean,
  mergeDistance: number,
  held: ReadonlySet<number> = new Set()
): BattlePlateGroup[] => {
  const half = PLATE_SLOT_PCT / 2;
  const clamp = (top: number) => Math.max(half, Math.min(100 - half, top));

  const groups: BattlePlateGroup[] = [];

  for (const opponent of opponents) {
    const wanted = clamp(
      distanceToTopPct(opponent.longitudinalDist, axisRange)
    );

    // Merging is decided in meters, not in pixels: two cars share a plate
    // because they are side by side on the track, not because the axis happens
    // to be zoomed out far enough to stack them.
    const mergeLimit = held.has(opponent.carIdx)
      ? mergeDistance * SPLIT_HYSTERESIS
      : mergeDistance;

    const collision = groups.find(
      (group) =>
        Math.abs(group.leader.longitudinalDist - opponent.longitudinalDist) <=
        mergeLimit
    );

    if (collision && mergeOverlapping) {
      // The key stays the leader's car: rewriting it when a lower carIdx joins
      // would remount the plate mid-battle and drop its position transition.
      collision.merged.push(opponent);
      continue;
    }

    let top = wanted;

    for (const group of groups) {
      if (Math.abs(top - group.topPct) < PLATE_SLOT_PCT) {
        top =
          top >= group.topPct
            ? group.topPct + PLATE_SLOT_PCT
            : group.topPct - PLATE_SLOT_PCT;
      }
    }

    groups.push({
      key: opponent.carIdx,
      leader: opponent,
      merged: [],
      topPct: clamp(top),
    });
  }

  return groups;
};

/** Every car currently drawn as part of somebody else's plate. */
export const mergedCarIdxs = (groups: BattlePlateGroup[]): Set<number> =>
  new Set(
    groups.flatMap((group) => group.merged.map((opponent) => opponent.carIdx))
  );

export const isWithinThreshold = (
  opponent: BattleOpponent,
  settings: CloseBattleWidgetSettings,
  hysteresis: number
): boolean => {
  const limit = activeThreshold(settings) * hysteresis;

  const value =
    settings.trigger === 'distance'
      ? opponent.clearance
      : Math.abs(opponent.gapSeconds);

  return value <= limit;
};

/**
 * The ranges the axis may settle on — one ladder per unit, in that unit. Both
 * cover the same ground; the imperial rungs are simply the round numbers a
 * reader of feet expects to see on a tick.
 */
export const AXIS_RANGE_STEPS = [5, 10, 25, 50, 100, 200];

export const AXIS_RANGE_STEPS_FEET = [15, 30, 75, 150, 300, 600];

/** Headroom above the farthest car, so its plate is not glued to the edge. */
const AUTO_RANGE_HEADROOM = 1.15;

/** How much of a narrower step must stay free before the axis drops to it. */
const SHRINK_MARGIN = 0.75;

/**
 * The narrowest step that still holds `meters`, capped at the widest one. The
 * ladder is picked by unit and the answer converted back, so the range always
 * lands on a number that ticks divide evenly.
 */
const fittingStep = (meters: number, isMetric: boolean): number => {
  const steps = isMetric ? AXIS_RANGE_STEPS : AXIS_RANGE_STEPS_FEET;
  const wanted = toDisplayDistance(meters, isMetric);
  const step = steps.find((rung) => rung >= wanted) ?? steps[steps.length - 1];

  return toMeters(step, isMetric);
};

/**
 * The axis range the widget actually draws — derived from the threshold that
 * makes the widget appear, never set apart from it. An axis wider than the
 * threshold can only ever draw its middle, and one narrower would clamp the
 * very cars the threshold let in.
 *
 * A distance threshold is already meters, so the axis is simply the step that
 * fits it: threshold 1 m still lands on the ±5 m step, because a plate is a
 * ninth of the axis tall and an axis of one metre says nothing.
 *
 * A gap threshold is seconds, and two seconds is 40 m in a hairpin and 150 m on
 * a straight — there is no fixed range to derive, so the axis zooms to the
 * farthest car instead. `held` is the range in force: it only zooms back out
 * once a car passes the current step, and only zooms in when the step below has
 * real room to spare, so it does not flip between two steps every tick.
 */
export const resolveAxisRange = (
  settings: CloseBattleWidgetSettings,
  farthestMeters: number,
  held: number,
  isMetric: boolean
): number => {
  if (settings.trigger === 'distance') {
    // No headroom here: a car sitting exactly at the threshold belongs at the
    // edge of the axis, which the edge inset already keeps off the border.
    return fittingStep(settings.distanceThreshold, isMetric);
  }

  const needed = farthestMeters * AUTO_RANGE_HEADROOM;
  const fitting = fittingStep(needed, isMetric);

  if (fitting > held) {
    return fitting;
  }

  // Shrinking needs room to spare, or a car hovering on a step boundary would
  // flip the whole axis back and forth every tick: the step it drops to is the
  // one the car still fits in with a quarter of the range left over.
  const shrunk = fittingStep(needed / SHRINK_MARGIN, isMetric);

  if (shrunk < held) {
    return shrunk;
  }

  return held;
};

export const matchesSides = (
  opponent: BattleOpponent,
  sides: CloseBattleWidgetSettings['sides']
): boolean => {
  if (sides === 'both') {
    return true;
  }

  if (sides === 'ahead') {
    return opponent.isAhead;
  }

  return !opponent.isAhead;
};

/**
 * The opponents worth drawing.
 *
 * Pace cars are dropped rather than merely absent: the widget answers "who is
 * racing me", and behind a safety car nobody is. The gap to it belongs to the
 * relative table, which already synthesises those rows on purpose.
 */
export const buildOpponents = (
  nearbyCars: NearbyCar[],
  entries: DriverEntry[],
  paceCarIdxs: ReadonlySet<number> = new Set()
): BattleOpponent[] => {
  const player = entries.find((entry) => entry.isPlayer) ?? null;

  if (!player) {
    return [];
  }

  const byCarIdx = new Map(entries.map((entry) => [entry.carIdx, entry]));

  return nearbyCars.flatMap((car) => {
    const entry = byCarIdx.get(car.carIdx);

    if (!entry || entry.isPlayer || paceCarIdxs.has(car.carIdx)) {
      return [];
    }

    return [
      {
        carIdx: car.carIdx,
        longitudinalDist: car.longitudinalDist,
        clearance: car.clearance,
        gapSeconds: computeRelativeGap(entry, player),
        entry,
        isOtherClass: entry.carClassId !== player.carClassId,
        isAhead: car.longitudinalDist >= 0,
        lapsApart: lapsBetween(entry, player),
      },
    ];
  });
};

/**
 * The gap keeps the Relative widget's convention exactly: a car ahead reads
 * negative and blue, a car behind reads positive and red. Two widgets telling
 * the same story with opposite signs is worse than either of them alone.
 */
export const formatBattleGap = (gapSeconds: number): string =>
  gapSeconds > 0 ? `+${gapSeconds.toFixed(2)}` : gapSeconds.toFixed(2);

export const formatBattleDistance = (
  clearance: number,
  isMetric: boolean
): string => {
  const value = isMetric ? clearance : clearance * METERS_TO_FEET;

  return `${Math.round(value)}${isMetric ? ' m' : ' ft'}`;
};

/**
 * The same distance, split at the unit.
 *
 * A right-aligned "9 m" becoming "10 m" pushes every digit of it one character
 * left, and at 10 Hz that reads as the number twitching in place. Split, the
 * unit owns a slot of its own and the digits grow into theirs, so the only
 * thing that changes on screen is the digit that actually changed.
 */
export const battleDistanceParts = (
  clearance: number,
  isMetric: boolean
): { value: string; unit: string } => {
  const value = isMetric ? clearance : clearance * METERS_TO_FEET;

  return {
    value: String(Math.round(value)),
    unit: isMetric ? 'm' : 'ft',
  };
};

/**
 * The gap, split at the decimal point — which is then the one thing on the
 * plate that never moves. Whole seconds grow leftwards into their own slot and
 * hundredths sit in theirs, so `9.95` turning into `10.02` shifts nothing but
 * the digits that changed.
 */
export const battleGapParts = (
  gapSeconds: number
): { whole: string; fraction: string } => {
  const [whole, fraction = '00'] = formatBattleGap(gapSeconds).split('.');

  return { whole, fraction };
};

/** The plate never shrinks past this: below it the row stops being readable. */
const MIN_PLATE_SCALE = 2 / 3;

/**
 * The distance at which a plate reaches its smallest size, in meters.
 *
 * Fixed on purpose, rather than a fraction of the axis: a car five metres away
 * is a car five metres away whether the axis is ±5 m or ±100 m, and scaling by
 * the fraction shrank a plate to its floor merely because the threshold was
 * tight — the widget then said "far" about a car in your mirrors, and did it in
 * type too small to read at the edge of the axis.
 *
 * So a close threshold barely shrinks anything (at ±5 m the outermost plate is
 * still 97% of full size), and a wide one spends the whole third it is allowed.
 */
const PLATE_SHRINK_METERS = 50;

/**
 * Distant plates shrink, but never past a third — below that the row stops
 * being readable and the size no longer says anything useful about distance.
 */
export const plateScale = (clearance: number): number => {
  const ratio = Math.max(0, Math.min(1, clearance / PLATE_SHRINK_METERS));

  return 1 - (1 - MIN_PLATE_SCALE) * ratio;
};

/**
 * The name as the plate spends its width on it. The surname is never dropped —
 * it is the part the eye catches at speed; what the mode decides is how much of
 * the given name earns the room in front of it.
 */
export const battleDriverName = (
  userName: string,
  mode: CloseBattleWidgetSettings['nameMode']
): { givenName: string; surname: string } => {
  const { givenName, surname } = splitDriverName(userName);

  if (mode === 'surname' || !givenName) {
    return { givenName: '', surname };
  }

  if (mode === 'initial') {
    return { givenName: `${givenName[0]}.`, surname };
  }

  return { givenName, surname };
};

/** 0 at the glow range, 1 in the player's bumper. */
export const glowIntensity = (clearance: number, glowRange: number): number => {
  if (glowRange <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, 1 - clearance / glowRange));
};
