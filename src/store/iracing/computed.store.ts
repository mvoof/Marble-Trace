import { makeAutoObservable } from 'mobx';

import type {
  DriverEntriesFrame,
  FuelComputedFrame,
  LapDeltaFrame,
  PitStopsFrame,
  ProximityFrame,
} from '../../types/bindings';

interface StartPosition {
  overall: number;
  class: number;
}

class ComputedStore {
  proximity: ProximityFrame | null = null;
  fuel: FuelComputedFrame | null = null;
  standings: DriverEntriesFrame | null = null;
  pitStops: PitStopsFrame | null = null;
  lapDelta: LapDeltaFrame | null = null;

  private readonly startPositionSnapshot = new Map<number, StartPosition>();

  constructor() {
    makeAutoObservable(this);
  }

  updateProximity(frame: ProximityFrame) {
    this.proximity = frame;
  }

  updateFuel(frame: FuelComputedFrame) {
    this.fuel = frame;
  }

  updateStandings(frame: DriverEntriesFrame) {
    for (const entry of frame.entries) {
      if (!this.startPositionSnapshot.has(entry.carIdx) && entry.position > 0) {
        this.startPositionSnapshot.set(entry.carIdx, {
          overall: entry.position,
          class: entry.classPosition,
        });
      }
    }
    this.standings = frame;
  }

  getEffectiveStartPos(carIdx: number): StartPosition {
    return this.startPositionSnapshot.get(carIdx) ?? { overall: 0, class: 0 };
  }

  updatePitStops(frame: PitStopsFrame) {
    this.pitStops = frame;
  }

  updateLapDelta(frame: LapDeltaFrame) {
    this.lapDelta = frame;
  }

  reset() {
    this.proximity = null;
    this.fuel = null;
    this.standings = null;
    this.pitStops = null;
    this.lapDelta = null;
    this.startPositionSnapshot.clear();
  }
}

export const computedStore = new ComputedStore();
