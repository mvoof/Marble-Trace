import { makeAutoObservable } from 'mobx';

import type {
  DriverEntriesFrame,
  FuelComputedFrame,
  LapDeltaFrame,
  PitStopsFrame,
  ProximityFrame,
} from '../../types/bindings';

class ComputedStore {
  proximity: ProximityFrame | null = null;
  fuel: FuelComputedFrame | null = null;
  standings: DriverEntriesFrame | null = null;
  pitStops: PitStopsFrame | null = null;
  lapDelta: LapDeltaFrame | null = null;

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
    this.standings = frame;
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
  }
}

export const computedStore = new ComputedStore();
