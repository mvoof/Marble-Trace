import { makeAutoObservable } from 'mobx';

import type {
  DriverEntriesFrame,
  DriverEntry,
  FuelComputedFrame,
  LapDeltaFrame,
  PitStopsFrame,
  ProximityFrame,
} from '@/types/bindings';
import type { DriverGroup } from '@/types';
import { telemetryStore } from './telemetry.store';

interface StartPosition {
  overall: number;
  class: number;
}

const computeClassSof = (drivers: DriverEntry[]): number => {
  if (drivers.length === 0) return 0;
  const total = drivers.reduce((sum, d) => sum + d.iRating, 0);
  return Math.round(total / drivers.length);
};

const computeRelativeLapDist = (
  lapDistPct: number,
  playerLapDistPct: number
): number => {
  let diff = lapDistPct - playerLapDistPct;
  if (diff < -0.5) diff += 1.0;
  if (diff > 0.5) diff -= 1.0;
  return diff;
};

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

  get driverMap(): Map<number, DriverEntry> {
    if (!this.standings) return new Map();
    return new Map(this.standings.entries.map((e) => [e.carIdx, e]));
  }

  get allClassGroups(): DriverGroup[] {
    const entries = this.standings?.entries ?? [];
    if (entries.length === 0) return [];

    const classMap = new Map<number, DriverEntry[]>();

    for (const d of entries) {
      const existing = classMap.get(d.carClassId);

      if (existing) {
        existing.push(d);
      } else {
        classMap.set(d.carClassId, [d]);
      }
    }

    return Array.from(classMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([classId, driversInClass]) => {
        const first = driversInClass[0];
        return {
          classId,
          className: first.carScreenNameShort,
          classShortName: first.carScreenNameShort,
          classColor: first.carClassColor,
          totalDrivers: driversInClass.length,
          classSof: computeClassSof(driversInClass),
          drivers: driversInClass.sort(
            (a, b) => a.classPosition - b.classPosition
          ),
        };
      });
  }

  get relativeEntries() {
    const standings = this.standings;
    const carPositions = telemetryStore.carPositions;

    const playerIdx = standings?.entries.find((e) => e.isPlayer)?.carIdx ?? -1;
    const playerLapDist =
      carPositions && playerIdx >= 0
        ? (carPositions.car_idx_lap_dist_pct[playerIdx] ?? 0)
        : 0;

    return (standings?.entries ?? [])
      .map((e) => {
        const lapDistPct =
          carPositions?.car_idx_lap_dist_pct[e.carIdx] ?? e.lapDistPct;

        return {
          ...e,
          lapDistPct,
          relativeLapDist: computeRelativeLapDist(lapDistPct, playerLapDist),
        };
      })
      .sort((a, b) => b.relativeLapDist - a.relativeLapDist);
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

  get qualifyStartPosMap() {
    const results = telemetryStore.sessionInfo?.QualifyResultsInfo?.Results;
    if (!results || results.length === 0) return null;

    const map = new Map<number, { overall: number; class: number }>();
    for (const r of results) {
      if (r.CarIdx != null && r.Position != null) {
        map.set(r.CarIdx, {
          overall: r.Position + 1,
          class: (r.ClassPosition ?? r.Position) + 1,
        });
      }
    }

    return map.size > 0 ? map : null;
  }

  getEffectiveStartPos(carIdx: number): StartPosition {
    return (
      this.qualifyStartPosMap?.get(carIdx) ??
      this.startPositionSnapshot.get(carIdx) ?? { overall: 0, class: 0 }
    );
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
