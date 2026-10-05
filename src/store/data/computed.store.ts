import { comparer, computed, makeAutoObservable, observable } from 'mobx';

import type {
  CarEntry,
  DriverEntriesFrame,
  FuelComputedFrame,
  IncidentsFrame,
  LapDeltaFrame,
  LapHistoryEntry,
  LapLogFrame,
  LastCompletedLap,
  PitStopsFrame,
  ProximityFrame,
  RelativeFrame,
} from '@/types/bindings';
import type { CarIdentity } from '@/types/car-identity';
import type { DriverEntry } from '@/types/driver-entry';
import { CarIdentityCache } from '@utils/car-identity';

import { DriverEntryJoin, rosterByCarIdx } from './driver-entry-join';
import type { SessionStore } from './session.store';

export class BackendComputedStore {
  /**
   * Heavy 10 Hz per-car frame — never read directly in a component render
   * body. Read it inside `useReactiveDomWrite`/`useReactiveCanvasLoop`;
   * `oxlint` enforces this (`no-restricted-properties`) for `src/ui/**\/*.tsx`.
   * @remarks See "The hot/cold split" in `docs/rendering.md`.
   */
  proximity: ProximityFrame | null = null;
  fuel: FuelComputedFrame | null = null;
  /**
   * Heavy 10 Hz per-car frame — never read directly in a component render
   * body. Read it inside `useReactiveDomWrite`/`useReactiveCanvasLoop`;
   * `oxlint` enforces this (`no-restricted-properties`) for `src/ui/**\/*.tsx`.
   * @remarks See "The hot/cold split" in `docs/rendering.md`.
   */
  relative: RelativeFrame | null = null;
  incidents: IncidentsFrame | null = null;
  /**
   * Heavy 10 Hz per-car frame — never read directly in a component render
   * body. Read it inside `useReactiveDomWrite`/`useReactiveCanvasLoop`;
   * `oxlint` enforces this (`no-restricted-properties`) for `src/ui/**\/*.tsx`.
   * @remarks See "The hot/cold split" in `docs/rendering.md`.
   */
  driverEntries: DriverEntriesFrame | null = null;
  pitStops: PitStopsFrame | null = null;
  /**
   * 60 Hz hot field — never read directly in a component render body. Read it
   * inside `useReactiveDomWrite`/`useReactiveCanvasLoop`; `oxlint` enforces
   * this (`no-restricted-properties`) for `src/ui/**\/*.tsx`.
   * @remarks See "The hot/cold split" in `docs/rendering.md`.
   */
  lapDelta: LapDeltaFrame | null = null;
  lapHistory: LapHistoryEntry[] = [];
  lastCompletedLap: LastCompletedLap | null = null;

  /**
   * Distinct car classes as counted by the backend and carried on the slow
   * slice. Only windows off the bundle ever read it — one that has
   * `driverEntries` counts them itself, below.
   */
  slowCarClassCount = 0;

  // Memo caches for the derivations below, not state: each hands back last
  // call's object for a car that did not change, so a frame allocates only
  // for the cars that moved.
  private readonly fieldJoin = new DriverEntryJoin();
  private readonly relativeJoin = new DriverEntryJoin();
  private readonly fieldIdentityCache = new CarIdentityCache();
  private readonly relativeIdentityCache = new CarIdentityCache();

  // Every telemetry frame is replaced wholesale — nothing ever mutates one in
  // place — so `observable.ref` is all the reactivity these need. Deep
  // observability would rebuild a proxy for each frame, and for the per-car
  // arrays it would convert ~15 arrays of 64 entries on every tick, purely to
  // observe fields nobody writes.
  constructor(private readonly session: SessionStore) {
    makeAutoObservable<
      this,
      | 'session'
      | 'fieldJoin'
      | 'relativeJoin'
      | 'fieldIdentityCache'
      | 'relativeIdentityCache'
    >(this, {
      session: false,
      fieldJoin: false,
      relativeJoin: false,
      fieldIdentityCache: false,
      relativeIdentityCache: false,
      proximity: observable.ref,
      fuel: observable.ref,
      relative: observable.ref,
      incidents: observable.ref,
      driverEntries: observable.ref,
      pitStops: observable.ref,
      lapDelta: observable.ref,
      lapHistory: observable.ref,
      lastCompletedLap: observable.ref,
      // The lap-delta frame is replaced on every tick while its sector arrays
      // change once a sector. Compared by content, they wake a widget when a
      // sector is actually posted rather than sixty times a second.
      sectorTimes: computed.struct,
      sectorDeltas: computed.struct,
      // Rebuilt when the session roster is, not when a frame arrives.
      roster: computed,
      // The per-car frames are replaced on every tick, but all a row or a dot
      // draws apart from a few numbers stays put for a whole lap. The cache
      // hands back the same object for a car that did not change, so the list
      // compares by reference, and wakes a widget when a car actually changes
      // rather than on every tick — see `docs/rendering.md`.
      driverIdentities: computed({ equals: comparer.shallow }),
      relativeIdentities: computed({ equals: comparer.shallow }),
    });
  }

  /**
   * Whether a proximity frame has arrived at all, as a stable flag. A widget
   * that only needs to know the radar has data reads this rather than the frame
   * itself, which is replaced on every tick.
   */
  get hasProximity(): boolean {
    return this.proximity !== null;
  }

  /**
   * The sector the car is in, off a lap-delta frame replaced on every tick.
   * Null while the car is off the lap, or before the first frame.
   */
  get currentSectorIdx(): number | null {
    return this.lapDelta?.currentSectorIdx ?? null;
  }

  /** Sector times for the lap so far, compared by content. */
  get sectorTimes(): (number | null)[] {
    return this.lapDelta?.sectorTimes ?? [];
  }

  /** Per-sector deltas against the personal best, compared by content. */
  get sectorDeltas(): (number | null)[] {
    return this.lapDelta?.sectorDeltas ?? [];
  }

  /** The spotter's left call, as a stable flag off the proximity frame. */
  get spotterLeft(): boolean {
    return this.proximity?.spotterLeft ?? false;
  }

  /** The spotter's right call, as a stable flag off the proximity frame. */
  get spotterRight(): boolean {
    return this.proximity?.spotterRight ?? false;
  }

  /**
   * How far the standings class cycle wraps. The overlay counts the entries it
   * already holds; the main window, which is off the bundle but owns the hotkey
   * runner, falls back to the count the slow slice brings it.
   */
  get carClassCount(): number {
    if (this.driverEntries) {
      return new Set(this.fieldEntries.map((entry) => entry.carClassId)).size;
    }

    return this.slowCarClassCount;
  }

  get roster(): Map<number, CarEntry> {
    return rosterByCarIdx(this.session.sessionInfo?.cars ?? []);
  }

  /**
   * The standings field in official order: the live entries joined with the
   * session roster, which carries everything about a car that does not move.
   * Heavy and replaced on every frame — read it where `driverEntries` may be.
   */
  get fieldEntries(): DriverEntry[] {
    return this.fieldJoin.join(this.driverEntries?.entries ?? [], this.roster);
  }

  /** The standings field as it is drawn, without the numbers that move. */
  get driverIdentities(): CarIdentity[] {
    return this.fieldIdentityCache.identitiesOf(this.fieldEntries);
  }

  /**
   * One car's live entry, moving numbers and all. Read inside a reaction that
   * writes to the DOM — a component that reads it in render wakes on every tick.
   */
  driverEntryOf(carIdx: number): DriverEntry | null {
    return this.fieldEntries.find((entry) => entry.carIdx === carIdx) ?? null;
  }

  /** The relative field as it is drawn, without the numbers that move. */
  get relativeIdentities(): CarIdentity[] {
    return this.relativeIdentityCache.identitiesOf(this.relativeEntries);
  }

  /** The relative field, joined with the roster like `fieldEntries`. */
  get relativeEntries(): DriverEntry[] {
    return this.relativeJoin.join(this.relative?.entries ?? [], this.roster);
  }

  updateRelative(frame: RelativeFrame) {
    this.relative = frame;
  }

  updateProximity(frame: ProximityFrame) {
    this.proximity = frame;
  }

  updateIncidents(frame: IncidentsFrame) {
    this.incidents = frame;
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
    this.incidents = null;
    this.driverEntries = null;
    this.pitStops = null;
    this.lapDelta = null;
    this.lapHistory = [];
    this.lastCompletedLap = null;
    this.slowCarClassCount = 0;
    this.fieldJoin.clear();
    this.relativeJoin.clear();
    this.fieldIdentityCache.clear();
    this.relativeIdentityCache.clear();
  }
}
