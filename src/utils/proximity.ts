/**
 * Proximity computation utility — reusable logic for computing
 * nearby car positions relative to the player car.
 *
 * Used by ProximityRadarWidget and RadarBarWidget.
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/caridxlapdistpct/
 * @see https://sajax.github.io/irsdkdocs/telemetry/carleftright/
 */
import type { CarIdxFrame } from '../types/bindings';
import { CarLeftRight } from '../types/car-left-right';

export interface NearbyCarInfo {
  carIdx: number;
  /** Meters ahead (+) or behind (-) */
  longitudinalDist: number;
  /** Lateral side based on CarLeftRight enum */
  lateralSide: 'left' | 'right' | 'center';
  /** Absolute longitudinal distance in meters */
  clearance: number;
}

export interface FrontRearDistances {
  /** Distance to closest car ahead (meters), Infinity if none */
  frontDist: number;
  /** Distance to closest car behind (meters), Infinity if none */
  rearDist: number;
}

export interface SpotterState {
  left: boolean;
  right: boolean;
}

/**
 * Extract closest front and rear car distances from nearby cars array.
 */
export const computeFrontRearDistances = (
  nearbyCars: NearbyCarInfo[]
): FrontRearDistances => {
  let frontDist = Infinity;
  let rearDist = Infinity;

  for (const car of nearbyCars) {
    if (car.longitudinalDist > 0) {
      frontDist = Math.min(frontDist, car.longitudinalDist);
    } else if (car.longitudinalDist < 0) {
      rearDist = Math.min(rearDist, Math.abs(car.longitudinalDist));
    }
  }

  return { frontDist, rearDist };
};

/**
 * Parse CarLeftRight enum value into left/right booleans.
 */
export interface SideCarDistances {
  /** Longitudinal offset of closest car on the left (+ ahead, - behind), null if none */
  leftDist: number | null;
  /** Longitudinal offset of closest car on the right (+ ahead, - behind), null if none */
  rightDist: number | null;
}

/**
 * Find the longitudinal offset of the closest side car for each side.
 * Used by RadarBarWidget to position the pill indicator.
 */
export const computeSideCarDistances = (
  nearbyCars: NearbyCarInfo[]
): SideCarDistances => {
  let leftDist: number | null = null;
  let rightDist: number | null = null;
  let leftClearance = Infinity;
  let rightClearance = Infinity;

  for (const car of nearbyCars) {
    if (car.lateralSide === 'left' && car.clearance < leftClearance) {
      leftClearance = car.clearance;
      leftDist = car.longitudinalDist;
    } else if (car.lateralSide === 'right' && car.clearance < rightClearance) {
      rightClearance = car.clearance;
      rightDist = car.longitudinalDist;
    }
  }

  return { leftDist, rightDist };
};

export const parseSpotterState = (carLeftRight: number): SpotterState => ({
  left:
    carLeftRight === CarLeftRight.CarLeft ||
    carLeftRight === CarLeftRight.CarLeftRight ||
    carLeftRight === CarLeftRight.Cars2Left,
  right:
    carLeftRight === CarLeftRight.CarRight ||
    carLeftRight === CarLeftRight.CarLeftRight ||
    carLeftRight === CarLeftRight.Cars2Right,
});

/**
 * Parse track length string from session info (e.g. "5.89 km") to meters.
 */
export const parseTrackLength = (trackLengthStr: string): number => {
  const match = trackLengthStr.match(/([\d.]+)\s*(km|mi)/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  return match[2] === 'km' ? value * 1000 : value * 1609.34;
};

/**
 * Compute nearby cars relative to the player.
 *
 * @param carIdxFrame - Per-car telemetry arrays
 * @param playerCarIdx - Player's car index in the arrays
 * @param trackLengthMeters - Track length in meters
 * @param maxDistMeters - Maximum distance to consider (filter radius)
 * @param carLeftRight - CarLeftRight enum value for lateral side assignment
 */
export const computeNearbyCars = (
  carIdxFrame: CarIdxFrame,
  playerCarIdx: number,
  trackLengthMeters: number,
  maxDistMeters: number,
  carLeftRight: number
): NearbyCarInfo[] => {
  const { car_idx_lap_dist_pct, car_idx_on_pit_road } = carIdxFrame;
  const playerDistPct = car_idx_lap_dist_pct[playerCarIdx];

  if (
    playerDistPct === undefined ||
    playerDistPct === -1 ||
    trackLengthMeters <= 0
  ) {
    return [];
  }

  const hasLeft =
    carLeftRight === CarLeftRight.CarLeft ||
    carLeftRight === CarLeftRight.CarLeftRight ||
    carLeftRight === CarLeftRight.Cars2Left;

  const hasRight =
    carLeftRight === CarLeftRight.CarRight ||
    carLeftRight === CarLeftRight.CarLeftRight ||
    carLeftRight === CarLeftRight.Cars2Right;

  const cars: { carIdx: number; longitudinalDist: number }[] = [];

  for (let i = 0; i < car_idx_lap_dist_pct.length; i++) {
    if (i === playerCarIdx) continue;

    const distPct = car_idx_lap_dist_pct[i];
    if (distPct === -1 || distPct === undefined) continue;
    if (car_idx_on_pit_road[i]) continue;

    let diffPct = distPct - playerDistPct;
    if (diffPct > 0.5) diffPct -= 1;
    else if (diffPct < -0.5) diffPct += 1;

    const longitudinalDist = diffPct * trackLengthMeters;

    if (Math.abs(longitudinalDist) <= maxDistMeters) {
      cars.push({ carIdx: i, longitudinalDist });
    }
  }

  // Sort by absolute distance (closest first)
  cars.sort(
    (a, b) => Math.abs(a.longitudinalDist) - Math.abs(b.longitudinalDist)
  );

  // Threshold: cars within this longitudinal distance could be alongside
  // (slightly more than car length to account for partial overlap)
  const ALONGSIDE_THRESHOLD = 5.0;

  // Assign lateral sides based on CarLeftRight
  // All cars within alongside threshold get the spotter-indicated side
  // Cars beyond threshold are clearly ahead/behind → center
  return cars.map((car) => {
    let lateralSide: 'left' | 'right' | 'center' = 'center';
    const isAlongside = Math.abs(car.longitudinalDist) < ALONGSIDE_THRESHOLD;

    if (isAlongside) {
      if (hasLeft && hasRight) {
        // 3-wide: distribute by longitudinal position
        lateralSide = car.longitudinalDist >= 0 ? 'right' : 'left';
      } else if (hasLeft) {
        lateralSide = 'left';
      } else if (hasRight) {
        lateralSide = 'right';
      }
    }

    if (carLeftRight === CarLeftRight.Off) {
      // Spotter disabled: alternate by position for testing
      lateralSide = car.longitudinalDist >= 0 ? 'left' : 'right';
    }

    return {
      carIdx: car.carIdx,
      longitudinalDist: car.longitudinalDist,
      lateralSide,
      clearance: Math.abs(car.longitudinalDist),
    };
  });
};
