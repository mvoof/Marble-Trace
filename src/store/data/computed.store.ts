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
  driverEntries: DriverEntriesFrame | null = null;
  pitStops: PitStopsFrame | null = null;
  lapDelta: LapDeltaFrame | null = null;
  lapHistory: LapHistoryEntry[] = [];
  lastCompletedLap: LastCompletedLap | null = null;

  /**
   * Distinct car classes as counted by the backend and carried on the slow
   * slice. Only windows off the bundle ever read it — one that has
   * `driverEntries` counts them itself, below.
   */
  slowCarClassCount = 0;

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
      driverEntries: observable.ref,
      pitStops: observable.ref,
      lapDelta: observable.ref,
      lapHistory: observable.ref,
      lastCompletedLap: observable.ref,
    });
  }

  /**
   * How far the standings class cycle wraps. The overlay counts the entries it
   * already holds; the main window, which is off the bundle but owns the hotkey
   * runner, falls back to the count the slow slice brings it.
   */
  get carClassCount(): number {
    if (this.driverEntries) {
      return new Set(
        this.driverEntries.entries.map((entry) => entry.carClassId)
      ).size;
    }

    return this.slowCarClassCount;
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

  updateSlowCarClassCount(count: number) {
    this.slowCarClassCount = count;
  }

  updateFuel(frame: FuelComputedFrame) {
    this.fuel = frame;
  }

  updateDriverEntries(frame: DriverEntriesFrame) {
    this.driverEntries = frame;
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
    this.driverEntries = null;
    this.pitStops = null;
    this.lapDelta = null;
    this.lapHistory = [];
    this.lastCompletedLap = null;
    this.slowCarClassCount = 0;
  }
}
