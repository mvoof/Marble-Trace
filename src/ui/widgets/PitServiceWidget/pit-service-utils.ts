import type {
  ChassisFrame,
  DriverEntry,
  PitServiceFrame,
} from '@/types/bindings';
import type { UnitSystem } from '@/types';
import { computeRelativeGap } from '@ui/widgets/RelativeWidget/relative-utils';

export type CornerPosition = 'lf' | 'rf' | 'lr' | 'rr';

/** Every corner, in the order the black box lists them. */
export const ALL_CORNERS: CornerPosition[] = ['lf', 'rf', 'lr', 'rr'];

export interface TireCornerData {
  wearL: number | null;
  wearM: number | null;
  wearR: number | null;
  tempL: number | null;
  tempM: number | null;
  tempR: number | null;
  tempColorL: string;
  tempColorM: string;
  tempColorR: string;
  pressure: number | null;
  isPunctured: boolean;
}

const KPA_TO_PSI = 0.145038;
const PUNCTURE_THRESHOLD_KPA = 50;

// Matches the semantic colors in _widget-tokens.scss.
const COLOR_COLD = '#3399ff';
const COLOR_OK = '#00cc44';
const COLOR_HOT = '#ffcc00';
const COLOR_CRITICAL = '#ff3333';
const COLOR_EMPTY = '#475569';

const TEMP_COLD_C = 75;
const TEMP_OK_C = 105;
const TEMP_HOT_C = 125;

const convertTemp = (celsius: number, system: UnitSystem): number =>
  system === 'metric' ? celsius : (celsius * 9) / 5 + 32;

export const convertPressure = (kpa: number, system: UnitSystem): number =>
  system === 'metric' ? kpa : kpa * KPA_TO_PSI;

const tempColor = (tempC: number | null | undefined): string => {
  if (tempC == null) return COLOR_EMPTY;
  if (tempC < TEMP_COLD_C) return COLOR_COLD;
  if (tempC <= TEMP_OK_C) return COLOR_OK;
  if (tempC <= TEMP_HOT_C) return COLOR_HOT;

  return COLOR_CRITICAL;
};

export const buildTireCorner = (
  position: CornerPosition,
  frame: ChassisFrame | null | undefined,
  system: UnitSystem
): TireCornerData => {
  const tempCL = frame?.[`${position}_temp_cl`];
  const tempCM = frame?.[`${position}_temp_cm`];
  const tempCR = frame?.[`${position}_temp_cr`];
  const pressureKpa = frame?.[`${position}_pressure`];

  return {
    wearL: frame?.[`${position}_wear_l`] ?? null,
    wearM: frame?.[`${position}_wear_m`] ?? null,
    wearR: frame?.[`${position}_wear_r`] ?? null,
    tempL: tempCL != null ? convertTemp(tempCL, system) : null,
    tempM: tempCM != null ? convertTemp(tempCM, system) : null,
    tempR: tempCR != null ? convertTemp(tempCR, system) : null,
    tempColorL: tempColor(tempCL),
    tempColorM: tempColor(tempCM),
    tempColorR: tempColor(tempCR),
    pressure: pressureKpa != null ? convertPressure(pressureKpa, system) : null,
    isPunctured:
      pressureKpa != null &&
      pressureKpa > 0 &&
      pressureKpa < PUNCTURE_THRESHOLD_KPA,
  };
};

export type WearLevel = 'good' | 'worn' | 'critical';

const WEAR_WORN = 0.65;
const WEAR_CRITICAL = 0.5;

export const wearLevel = (wear: number | null): WearLevel => {
  if (wear === null || wear >= WEAR_WORN) return 'good';
  if (wear >= WEAR_CRITICAL) return 'worn';

  return 'critical';
};

const WEAR_TO_PCT = 100;

/**
 * Remaining tread of the most worn of the three points across a corner, 0..1.
 * The worst point decides: a tire that is down to the cords on the outer
 * shoulder is finished no matter how healthy its middle still reads.
 */
export const cornerWorstWear = (
  position: CornerPosition,
  frame: ChassisFrame | null | undefined
): number | null => {
  const points = [
    frame?.[`${position}_wear_l`],
    frame?.[`${position}_wear_m`],
    frame?.[`${position}_wear_r`],
  ].filter((wear): wear is number => wear != null);

  if (points.length === 0) return null;

  return Math.min(...points);
};

/**
 * Corners worn down to `thresholdPct` remaining tread or below. A corner the
 * sim reports nothing for is left out — an unknown tire is not a worn one, and
 * ordering it would spend a stop on a guess.
 */
export const cornersBelowWearThreshold = (
  frame: ChassisFrame | null | undefined,
  thresholdPct: number
): CornerPosition[] =>
  ALL_CORNERS.filter((position) => {
    const wear = cornerWorstWear(position, frame);

    return wear !== null && wear * WEAR_TO_PCT <= thresholdPct;
  });

export const isCornerOrdered = (
  position: CornerPosition,
  service: PitServiceFrame | null | undefined
): boolean => {
  if (!service) return false;

  const byPosition: Record<CornerPosition, boolean> = {
    lf: service.changeLf,
    rf: service.changeRf,
    lr: service.changeLr,
    rr: service.changeRr,
  };

  return byPosition[position];
};

export const orderedPressure = (
  position: CornerPosition,
  service: PitServiceFrame | null | undefined
): number | null => {
  if (!service) return null;

  const byPosition: Record<CornerPosition, number | null> = {
    lf: service.lfPressure,
    rf: service.rfPressure,
    lr: service.lrPressure,
    rr: service.rrPressure,
  };

  return byPosition[position];
};

export type ServiceState = 'idle' | 'armed' | 'servicing' | 'towing';

export const resolveServiceState = (
  service: PitServiceFrame | null | undefined,
  inPitStall: boolean
): ServiceState => {
  if ((service?.towTimeS ?? 0) > 0) {
    return 'towing';
  }

  if (inPitStall) {
    return 'servicing';
  }

  const hasOrder =
    service !== null &&
    service !== undefined &&
    (service.changeLf ||
      service.changeRf ||
      service.changeLr ||
      service.changeRr ||
      service.addFuel ||
      service.fastRepair ||
      service.cleanWindshield);

  return hasOrder ? 'armed' : 'idle';
};

/**
 * Share of the speed row the green track covers: everything up to the limit.
 * The short red remainder is the overspeed tip, so the seam between them is the
 * limit itself and a small overspeed is still visible instead of pinning.
 */
export const SPEED_GREEN_SHARE = 0.82;

/** How far past the limit the red tip reaches, as a share of the limit. */
export const OVER_RANGE_PCT = 0.2;

/** Reaction time granted to the driver before the lift has to happen. */
const LIFT_LEAD_S = 0.3;

export interface SpeedRowView {
  /** Fill inside the green track, 0..SPEED_GREEN_SHARE. */
  fill: number;
  /** Fill inside the red tip, 0..(1 - SPEED_GREEN_SHARE). */
  overFill: number;
  /** Speed left before the limit, in the display unit. Negative once over. */
  margin: number;
  isOver: boolean;
  /**
   * Band the car coasts into if the throttle is held for `LIFT_LEAD_S` more.
   * `null` while the car is not gaining speed — there is nothing to lift for.
   */
  liftStart: number | null;
  liftWidth: number | null;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Everything the speed row draws, from the two numbers the sim gives and the
 * longitudinal acceleration. Kept out of the component so the thresholds are
 * testable and the row stays a rendering of them.
 */
export const buildSpeedRow = (
  speedMs: number,
  limitMs: number,
  longAccelMs2: number | null,
  speedFactor: number
): SpeedRowView => {
  if (limitMs <= 0) {
    return {
      fill: 0,
      overFill: 0,
      margin: 0,
      isOver: false,
      liftStart: null,
      liftWidth: null,
    };
  }

  const isOver = speedMs > limitMs;
  const margin = (limitMs - speedMs) * speedFactor;

  const fill = clamp01(speedMs / limitMs) * SPEED_GREEN_SHARE;
  const overShare = clamp01((speedMs - limitMs) / (limitMs * OVER_RANGE_PCT));
  const overFill = isOver ? overShare * (1 - SPEED_GREEN_SHARE) : 0;

  // Where the car ends up if nothing changes. Below the limit that band is the
  // last moment to lift; at or past it the red fill already says the same.
  const projected = speedMs + Math.max(0, longAccelMs2 ?? 0) * LIFT_LEAD_S;
  const hasLift = !isOver && projected > speedMs;
  const liftEnd = hasLift
    ? clamp01(projected / limitMs) * SPEED_GREEN_SHARE
    : null;

  return {
    fill,
    overFill,
    margin,
    isOver,
    liftStart: liftEnd === null ? null : fill,
    liftWidth: liftEnd === null ? null : Math.max(0, liftEnd - fill),
  };
};

/** `-12` / `+2` — the sign is the whole message, so it is always written. */
export const formatSpeedMargin = (margin: number): string => {
  const rounded = Math.round(margin);

  return rounded > 0 ? `-${rounded}` : `+${Math.abs(rounded)}`;
};

/**
 * How many cars currently behind us on track get past while we stand still for
 * `secondsLost`.
 *
 * It is a first-order estimate, not a race prediction: it assumes the cars
 * behind keep their current pace and do not pit themselves. That is exactly
 * the question being asked in the box — "who comes out in front of me if this
 * takes another twelve seconds" — and the answer stops being useful the moment
 * it pretends to more precision than that. Cars already in the pit lane are
 * skipped: they are losing the same time we are.
 */
export const projectPositionsLost = (
  entries: DriverEntry[],
  secondsLost: number,
  byClass: boolean,
  useLivePositions: boolean
): number => {
  if (secondsLost <= 0) return 0;

  const player = entries.find((entry) => entry.isPlayer);

  if (!player) return 0;

  const rankOf = (entry: DriverEntry): number => {
    if (byClass) {
      return useLivePositions
        ? entry.liveClassPosition || entry.classPosition
        : entry.classPosition;
    }

    return useLivePositions
      ? entry.livePosition || entry.position
      : entry.position;
  };

  const playerRank = rankOf(player);

  return entries.filter((entry) => {
    if (entry.isPlayer || entry.onPitRoad || entry.isRetired) return false;

    if (byClass && entry.carClassId !== player.carClassId) return false;

    // Nearby on track is not the same as racing us for a place: lapped and
    // lapping traffic sits right behind on the relative but cannot take a
    // position we hold. Only cars ranked behind us can.
    const rank = rankOf(entry);

    if (!rank || !playerRank || rank <= playerRank) return false;

    // Only cars behind can gain a position on a stationary car.
    if (entry.relativeLapDist >= 0) return false;

    return Math.abs(computeRelativeGap(entry, player)) < secondsLost;
  }).length;
};

const SECONDS_IN_MINUTE = 60;

/**
 * Countdown readout for repair and tow timers. Anything under a minute stays
 * in plain seconds — "0:41" reads slower than "41 s" when it is the number the
 * driver is waiting on — and longer waits switch to m:ss.
 */
export const formatCountdown = (seconds: number | null | undefined): string => {
  if (seconds == null || seconds <= 0) return '0';

  if (seconds < SECONDS_IN_MINUTE) {
    return seconds.toFixed(1);
  }

  const minutes = Math.floor(seconds / SECONDS_IN_MINUTE);
  const rest = Math.floor(seconds % SECONDS_IN_MINUTE);

  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};

export const countdownUnit = (seconds: number | null | undefined): string =>
  seconds != null && seconds >= SECONDS_IN_MINUTE ? '' : ' s';
