import { makeAutoObservable, reaction } from 'mobx';

import type { RootStore } from '@store/root-store';

type PaceCarDeps = Pick<RootStore, 'cars' | 'session'>;

export type PaceCarPitPhase =
  | 'unknown'
  | 'onTrack'
  | 'stall'
  | 'pitIn'
  | 'pitOut';

const NOT_IN_WORLD = -1;
const IN_PIT_STALL = 1;
const APPROACHING_PITS = 2;
const ON_TRACK = 3;

// Raw numeric TrkLoc value from CarPositionsFrame (60 Hz) — see
// src-tauri/src/model/cars.rs. AproachingPits covers the whole pit lane in
// both directions, so distinguishing entry from exit needs the previous
// phase: coming from onTrack means it's pitting in, coming from stall means
// it's pitting back out.
//
// NotInWorld is not a location, it is the absence of one — the pace car spends
// most of a session there. Carrying the previous phase across it is what made
// the phase stick: a car that left the pits and was then removed from the world
// stayed 'pitOut' forever, and one that was already parked when the app started
// never left the initial phase at all. So it resets to 'unknown', which reads as
// "not on track" everywhere the phase gates drawing.
export const nextPaceCarPitPhase = (
  trackSurface: number,
  previousPhase: PaceCarPitPhase,
  isOnPitRoad = false
): PaceCarPitPhase => {
  // TrkLoc describes where a car is driving, and the pace car does not drive —
  // it is placed. Parked in its box it can still report OnTrack, which is why
  // the surface alone never hid it. CarIdxOnPitRoad is a separate flag on the
  // 10 Hz frame and is set whatever the surface says, so it overrules an
  // on-track reading rather than being merged into one.
  if (isOnPitRoad && trackSurface === ON_TRACK) {
    return previousPhase === 'stall' || previousPhase === 'pitOut'
      ? 'pitOut'
      : 'pitIn';
  }

  if (trackSurface === NOT_IN_WORLD) return 'unknown';

  if (trackSurface === IN_PIT_STALL) return 'stall';

  if (trackSurface === ON_TRACK) return 'onTrack';

  if (trackSurface === APPROACHING_PITS) {
    // With no trustworthy previous phase there is no way to tell entry from
    // exit, so assume entry: the conservative half, which stays hidden until a
    // real on-track reading arrives.
    return previousPhase === 'stall' || previousPhase === 'pitOut'
      ? 'pitOut'
      : 'pitIn';
  }

  return previousPhase;
};

export class PaceCarStore {
  private readonly phaseByCarIdx = new Map<number, PaceCarPitPhase>();

  constructor(private readonly root: PaceCarDeps) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  init() {
    reaction(
      () => this.root.cars.carPositions,
      (carPositions) => {
        if (!carPositions) return;

        for (const car of this.root.session.sessionInfo?.cars ?? []) {
          if (!car.isPaceCar) continue;

          const idx = car.carIdx;
          const surface =
            carPositions.car_idx_track_surface[idx] ?? NOT_IN_WORLD;
          const isOnPitRoad =
            this.root.cars.carIdx?.car_idx_on_pit_road[idx] ?? false;
          const previousPhase = this.phaseByCarIdx.get(idx) ?? 'unknown';

          this.phaseByCarIdx.set(
            idx,
            nextPaceCarPitPhase(surface, previousPhase, isOnPitRoad)
          );
        }
      }
    );
  }

  // Split off the session-derived half on purpose: the roster changes once a
  // session, while `carPositions` arrives on the fast tier. Kept together, the
  // filter allocated a fresh array on every frame to rebuild the same list.
  private get paceCarIdxs(): number[] {
    return (this.root.session.sessionInfo?.cars ?? [])
      .filter((car) => car.isPaceCar)
      .map((car) => car.carIdx);
  }

  get isPaceCarOnTrack(): boolean {
    const carPositions = this.root.cars.carPositions;

    if (!carPositions) return false;

    const carIdxFrame = this.root.cars.carIdx;

    return this.paceCarIdxs.some(
      (carIdx) =>
        carPositions.car_idx_track_surface[carIdx] === ON_TRACK &&
        !(carIdxFrame?.car_idx_on_pit_road[carIdx] ?? false)
    );
  }

  getPitPhase(carIdx: number): PaceCarPitPhase {
    return this.phaseByCarIdx.get(carIdx) ?? 'unknown';
  }

  reset() {
    this.phaseByCarIdx.clear();
  }
}
