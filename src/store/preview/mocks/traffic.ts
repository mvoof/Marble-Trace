import type {
  LateralSide,
  NearbyCar,
  ProximityFrame,
  RadarDistances,
} from '@/types/bindings';

// Mock builders for the traffic domain — the cars around the player that the
// two radars and Close Battle draw. Pure: a scenario states only where the
// cars are, and a *complete* frame typed from the generated bindings comes
// back, so a field added to the contract breaks this file rather than leaking
// silently into every fixture. Nothing here touches a store.
//
// Every value a scenario does not state is derived here the way
// `computations/proximity.rs` derives it from a real tick — the clearance, the
// bumper gap, the order the cars arrive in, the four radar distances and the
// two spotter flags. Hand-setting them is how a fixture ends up showing a
// radar bar a side distance the car list does not contain.

/**
 * One car of traffic, as a scenario states it: who it is, how far along the
 * track it sits, and which side of the player it is on.
 */
export interface MockTrafficCar {
  carIdx: number;
  /** Metres centre to centre, positive ahead of the player. */
  longitudinalDist: number;
  side: LateralSide;
}

/**
 * The shipped default car length. The preview has no backend to take the real
 * one from, and every derived gap below is measured against it.
 */
export const PREVIEW_CAR_LENGTH_M = 4.4;

/** Beyond this the backend stops calling a car ahead or behind a bumper gap. */
const BUMPER_THRESHOLD_M = 2.2;
/** What the backend reports when nothing is in range on that side. */
const NO_CAR_DIST_M = 999;

const bumperGap = (clearance: number): number =>
  Math.max(0, clearance - PREVIEW_CAR_LENGTH_M);

const toNearbyCar = ({
  carIdx,
  longitudinalDist,
  side,
}: MockTrafficCar): NearbyCar => {
  const clearance = Math.abs(longitudinalDist);

  return {
    carIdx,
    longitudinalDist,
    lateralSide: side,
    clearance,
    bumperDist: bumperGap(clearance) * Math.sign(longitudinalDist),
  };
};

// The side pills read the nearest car on their own side, and the front and
// rear readouts then skip whichever cars those two pills already show — a car
// alongside is not also a car ahead. Same order, same exclusions as the
// backend, so a scenario cannot show the bar a distance its cars deny.
const nearestOnSide = (
  cars: NearbyCar[],
  side: LateralSide
): NearbyCar | null =>
  cars.reduce<NearbyCar | null>((nearest, car) => {
    if (car.lateralSide !== side) {
      return nearest;
    }

    if (nearest && nearest.clearance <= car.clearance) {
      return nearest;
    }

    return car;
  }, null);

const computeRadarDistances = (cars: NearbyCar[]): RadarDistances => {
  const left = nearestOnSide(cars, 'left');
  const right = nearestOnSide(cars, 'right');
  const claimed = new Set(
    [left?.carIdx, right?.carIdx].filter((carIdx) => carIdx !== undefined)
  );

  let frontDist = NO_CAR_DIST_M;
  let rearDist = NO_CAR_DIST_M;

  for (const car of cars) {
    if (claimed.has(car.carIdx)) {
      continue;
    }

    if (car.longitudinalDist > BUMPER_THRESHOLD_M) {
      frontDist = Math.min(frontDist, bumperGap(car.clearance));
    }

    if (car.longitudinalDist < -BUMPER_THRESHOLD_M) {
      rearDist = Math.min(rearDist, bumperGap(car.clearance));
    }
  }

  return {
    frontDist,
    rearDist,
    leftDist: left?.longitudinalDist ?? null,
    rightDist: right?.longitudinalDist ?? null,
  };
};

/**
 * The traffic around the player, as a complete proximity frame.
 *
 * The cars arrive nearest first, the way the backend sorts them — the widgets
 * that cap their rows keep the first ones, so an unsorted fixture drops the
 * wrong cars.
 */
export const mockProximity = (cars: MockTrafficCar[]): ProximityFrame => {
  const nearbyCars = cars
    .map(toNearbyCar)
    .sort((first, second) => first.clearance - second.clearance);

  return {
    nearbyCars,
    radarDistances: computeRadarDistances(nearbyCars),
    // The spotter is what puts a car on a side in the first place, so a frame
    // holding one and reporting a clear side is a state no tick produces.
    spotterLeft: nearbyCars.some((car) => car.lateralSide === 'left'),
    spotterRight: nearbyCars.some((car) => car.lateralSide === 'right'),
  };
};
