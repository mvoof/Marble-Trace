import { makeAutoObservable, observable } from 'mobx';

import type {
  DriverEntriesFrame,
  DriverEntry,
  FuelComputedFrame,
  LapDeltaFrame,
  LapHistoryEntry,
  LapLogFrame,
  LastCompletedLap,
  PitStopsFrame,
  ProximityFrame,
  RelativeFrame,
} from '@/types/bindings';

export class BackendComputedStore {
  proximity: ProximityFrame | null = null;
  fuel: FuelComputedFrame | null = null;
  relative: RelativeFrame | null = null;
  standings: DriverEntriesFrame | null = null;
  pitStops: PitStopsFrame | null = null;
  lapDelta: LapDeltaFrame | null = null;
  lapHistory: LapHistoryEntry[] = [];
  lastCompletedLap: LastCompletedLap | null = null;

  // Every telemetry frame is replaced wholesale — nothing ever mutates one in
  // place — so `observable.ref` is all the reactivity these need. Deep
  // observability would rebuild a proxy for each frame, and for the per-car
  // arrays it would convert ~15 arrays of 64 entries on every tick, purely to
  // observe fields nobody writes.
  constructor() {
    makeAutoObservable(this, {
      proximity: observable.ref,
      fuel: observable.ref,
      relative: observable.ref,
      standings: observable.ref,
      pitStops: observable.ref,
      lapDelta: observable.ref,
      lapHistory: observable.ref,
      lastCompletedLap: observable.ref,
    });
  }

  get relativeEntries(): DriverEntry[] {
    return this.relative?.entries ?? [];
  }

  updateRelative(frame: RelativeFrame) {
    this.relative = frame;
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

  updateLapLog(frame: LapLogFrame) {
    this.lapHistory = frame.history;
    this.lastCompletedLap = frame.lastCompletedLap ?? null;
  }

  reset() {
    this.proximity = null;
    this.fuel = null;
    this.relative = null;
    this.standings = null;
    this.pitStops = null;
    this.lapDelta = null;
    this.lapHistory = [];
    this.lastCompletedLap = null;
  }
}
