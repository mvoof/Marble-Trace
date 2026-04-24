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
import type {
  NearbyCarInfo,
  FrontRearDistances,
  SpotterState,
  SideCarDistances,
  ComputedRadarDistances,
} from '../types/proximity';

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

/**
 * Unified radar logic middleware.
 * Ensures a single opponent car appears in only one visual zone.
 *
 * Rules:
 * 1. If spotter indicates left/right, find the closest car on that side. Exclude its carIdx.
 * 2. From REMAINING cars, find the closest front car (longitudinalDist > 2.2).
 * 3. From REMAINING cars, find the closest rear car (longitudinalDist < -2.2).
 */
export const computeRadarDistances = (
  nearbyCars: NearbyCarInfo[],
  spotter: SpotterState
): ComputedRadarDistances => {
  let leftDist: number | null = null;
  let rightDist: number | null = null;
  let leftIdx = -1;
  let rightIdx = -1;

  let leftClearance = Infinity;
  let rightClearance = Infinity;

  // Step 1: Side Zones (Priority #1)
  if (spotter.left || spotter.right) {
    for (const car of nearbyCars) {
      if (
        spotter.left &&
        car.lateralSide === 'left' &&
        car.clearance < leftClearance
      ) {
        leftClearance = car.clearance;
        leftDist = car.longitudinalDist;
        leftIdx = car.carIdx;
      }
      if (
        spotter.right &&
        car.lateralSide === 'right' &&
        car.clearance < rightClearance
      ) {
        leftClearance = car.clearance;
        rightDist = car.longitudinalDist;
        rightIdx = car.carIdx;
      }
    }
  }

  let frontDist = Infinity;
  let rearDist = Infinity;

  // Car half-length threshold for front/rear classification
  const BUMPER_THRESHOLD = 2.2;
  const CAR_LENGTH = 2 * BUMPER_THRESHOLD;

  // Step 2 & 3: Front and Rear Zones from REMAINING cars
  for (const car of nearbyCars) {
    // Exclude cars already assigned to the sides
    if (car.carIdx === leftIdx || car.carIdx === rightIdx) {
      continue;
    }

    if (car.longitudinalDist > BUMPER_THRESHOLD) {
      const gap = Math.max(0, car.longitudinalDist - CAR_LENGTH);
      frontDist = Math.min(frontDist, gap);
    } else if (car.longitudinalDist < -BUMPER_THRESHOLD) {
      const gap = Math.max(0, Math.abs(car.longitudinalDist) - CAR_LENGTH);
      rearDist = Math.min(rearDist, gap);
    }
  }

  return {
    frontDist,
    rearDist,
    sideCars: { leftDist, rightDist },
  };
};

export const parseSpotterState = (
  carLeftRight: CarLeftRight
): SpotterState => ({
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
  carLeftRight: CarLeftRight
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
