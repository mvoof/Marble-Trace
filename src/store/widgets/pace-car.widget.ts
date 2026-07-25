import { makeAutoObservable, reaction } from 'mobx';

import type { RootStore } from '@store/root-store';

export type PaceCarPitPhase = 'onTrack' | 'stall' | 'pitIn' | 'pitOut';

const NOT_IN_WORLD = -1;
const IN_PIT_STALL = 1;
const APPROACHING_PITS = 2;
const ON_TRACK = 3;

// Raw numeric TrkLoc value from CarPositionsFrame (60 Hz) — see
// src-tauri/src/model/cars.rs. AproachingPits covers the whole pit lane in
// both directions, so distinguishing entry from exit needs the previous
// phase: coming from onTrack means it's pitting in, coming from stall means
// it's pitting back out.
export const nextPaceCarPitPhase = (
  trackSurface: number,
  previousPhase: PaceCarPitPhase
): PaceCarPitPhase => {
  if (trackSurface === IN_PIT_STALL) return 'stall';
  if (trackSurface === ON_TRACK) return 'onTrack';

  if (trackSurface === APPROACHING_PITS) {
    return previousPhase === 'stall' || previousPhase === 'pitOut'
      ? 'pitOut'
      : 'pitIn';
  }

  return previousPhase;
};

export class PaceCarStore {
  private readonly phaseByCarIdx = new Map<number, PaceCarPitPhase>();

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  init() {
    reaction(
      () => this.root.cars.carPositions,
      (carPositions) => {
        if (!carPositions) return;

        const paceCarIndices = (this.root.session.sessionInfo?.cars ?? [])
          .filter((car) => car.isPaceCar)
          .map((car) => car.carIdx);

        for (const idx of paceCarIndices) {
          const surface =
            carPositions.car_idx_track_surface[idx] ?? NOT_IN_WORLD;
          const previousPhase = this.phaseByCarIdx.get(idx) ?? 'onTrack';

          this.phaseByCarIdx.set(
            idx,
            nextPaceCarPitPhase(surface, previousPhase)
          );
        }
      }
    );
  }

  get isPaceCarOnTrack(): boolean {
    const carPositions = this.root.cars.carPositions;

    if (!carPositions) return false;

    return (this.root.session.sessionInfo?.cars ?? [])
      .filter((car) => car.isPaceCar)
      .some(
        (car) => carPositions.car_idx_track_surface[car.carIdx] === ON_TRACK
      );
  }

  getPitPhase(carIdx: number): PaceCarPitPhase {
    return this.phaseByCarIdx.get(carIdx) ?? 'onTrack';
  }

  reset() {
    this.phaseByCarIdx.clear();
  }
}
