import { makeAutoObservable, reaction, type IReactionDisposer } from 'mobx';

import type { RendererCore } from '@store/renderer-core';

type PaceCarDeps = Pick<RendererCore, 'cars' | 'session'>;

export type PaceCarPitPhase =
  | 'unknown'
  | 'onTrack'
  | 'stall'
  | 'pitIn'
  | 'pitOut'
  | 'parked';

const NOT_IN_WORLD = -1;
const IN_PIT_STALL = 1;
const APPROACHING_PITS = 2;
const ON_TRACK = 3;

// How long the lap distance may stand still before a car on pit road counts as
// parked. Positions arrive rounded and repeats are not re-sent, so two frames
// in a row can match for a car rolling down the pit lane — stillness has to
// hold for a while before it means anything.
const PARKED_AFTER_MS = 2000;

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
//
// Leaving the stall does not mean leaving the pits: the pace car is moved from
// its box to a parking spot on the pit lane and sits there, still reporting
// AproachingPits. Read as "came from the stall" that was a pit exit that never
// ended, so a car standing still on pit road is 'parked' instead — and counts
// as having come from a stop once it moves again.
export const nextPaceCarPitPhase = (
  trackSurface: number,
  previousPhase: PaceCarPitPhase,
  isOnPitRoad = false,
  isStationary = false
): PaceCarPitPhase => {
  const isInPitLane =
    trackSurface === APPROACHING_PITS ||
    (isOnPitRoad && trackSurface === ON_TRACK);

  if (isInPitLane && isStationary) return 'parked';

  const cameFromStop =
    previousPhase === 'stall' ||
    previousPhase === 'pitOut' ||
    previousPhase === 'parked';

  // TrkLoc describes where a car is driving, and the pace car does not drive —
  // it is placed. Parked in its box it can still report OnTrack, which is why
  // the surface alone never hid it. CarIdxOnPitRoad is a separate flag on the
  // 10 Hz frame and is set whatever the surface says, so it overrules an
  // on-track reading rather than being merged into one.
  if (isOnPitRoad && trackSurface === ON_TRACK) {
    return cameFromStop ? 'pitOut' : 'pitIn';
  }

  if (trackSurface === NOT_IN_WORLD) return 'unknown';

  if (trackSurface === IN_PIT_STALL) return 'stall';

  if (trackSurface === ON_TRACK) return 'onTrack';

  if (trackSurface === APPROACHING_PITS) {
    // With no trustworthy previous phase there is no way to tell entry from
    // exit, so assume entry: the conservative half, which stays hidden until a
    // real on-track reading arrives.
    return cameFromStop ? 'pitOut' : 'pitIn';
  }

  return previousPhase;
};

export class PaceCarStore {
  private readonly phaseByCarIdx = new Map<number, PaceCarPitPhase>();

  private readonly motionByCarIdx = new Map<
    number,
    { lapDistPct: number; movedAt: number }
  >();

  private readonly disposers: IReactionDisposer[] = [];

  constructor(private readonly root: PaceCarDeps) {
    makeAutoObservable<PaceCarStore, 'disposers' | 'motionByCarIdx'>(
      this,
      { disposers: false, motionByCarIdx: false },
      { autoBind: true }
    );
  }

  init() {
    this.disposers.push(
      reaction(
        () => this.root.cars.carPositions,
        (carPositions) => {
          if (!carPositions) return;

          const now = performance.now();

          for (const car of this.root.session.sessionInfo?.cars ?? []) {
            if (!car.isPaceCar) continue;

            const idx = car.carIdx;
            const surface =
              carPositions.car_idx_track_surface[idx] ?? NOT_IN_WORLD;
            const isOnPitRoad =
              this.root.cars.carIdx?.car_idx_on_pit_road[idx] ?? false;
            const previousPhase = this.phaseByCarIdx.get(idx) ?? 'unknown';
            const isStationary = this.trackStillness(
              idx,
              carPositions.car_idx_lap_dist_pct[idx] ?? NOT_IN_WORLD,
              now
            );

            this.phaseByCarIdx.set(
              idx,
              nextPaceCarPitPhase(
                surface,
                previousPhase,
                isOnPitRoad,
                isStationary
              )
            );
          }
        }
      )
    );
  }

  private trackStillness(
    carIdx: number,
    lapDistPct: number,
    now: number
  ): boolean {
    const motion = this.motionByCarIdx.get(carIdx);

    if (!motion || motion.lapDistPct !== lapDistPct) {
      this.motionByCarIdx.set(carIdx, { lapDistPct, movedAt: now });

      return false;
    }

    return now - motion.movedAt >= PARKED_AFTER_MS;
  }

  // Started by the first widget that reads the phases and stopped by the last
  // (`SharedWidgetStores`), so it must be able to start again afterwards.
  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
    this.reset();
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
    this.motionByCarIdx.clear();
  }
}
