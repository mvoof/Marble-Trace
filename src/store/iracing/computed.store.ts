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
import type { RootStore } from '../root-store';

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

export class BackendComputedStore {
  proximity: ProximityFrame | null = null;
  fuel: FuelComputedFrame | null = null;
  standings: DriverEntriesFrame | null = null;
  pitStops: PitStopsFrame | null = null;
  lapDelta: LapDeltaFrame | null = null;
  driverPitStates = new Map<number, 'none' | 'in' | 'stall' | 'exit'>();

  private readonly startPositionSnapshot = new Map<number, StartPosition>();

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this);
  }

  get driverMap(): Map<number, DriverEntry> {
    if (!this.standings) return new Map();

    return new Map(this.standings.entries.map((e) => [e.carIdx, e]));
  }

  get classLeaders(): Map<number, DriverEntry> {
    const map = new Map<number, DriverEntry>();
    if (!this.standings) return map;

    for (const entry of this.standings.entries) {
      if (entry.classPosition === 1) {
        map.set(entry.carClassId, entry);
      }
    }

    return map;
  }

  get overallLeader(): DriverEntry | null {
    if (!this.standings) return null;

    return this.standings.entries.find((entry) => entry.position === 1) ?? null;
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

  get p1LapTime(): number | null {
    const standingsEntries = this.standings?.entries ?? [];
    const allBestTimes =
      this.root.telemetry.carIdx?.car_idx_best_lap_time ?? [];

    const playerClassId = standingsEntries.find(
      (entry) => entry.isPlayer
    )?.carClassId;

    const classEntries =
      playerClassId !== undefined
        ? standingsEntries.filter((entry) => entry.carClassId === playerClassId)
        : [];

    const classBestTimes = classEntries.reduce<number[]>((acc, entry) => {
      const bestTime = allBestTimes[entry.carIdx];

      if (bestTime !== undefined && bestTime > 0) {
        acc.push(bestTime);
      }

      return acc;
    }, []);

    const timesToUse =
      classBestTimes.length > 0
        ? classBestTimes
        : allBestTimes.filter((time) => time > 0);

    return timesToUse.length > 0 ? Math.min(...timesToUse) : null;
  }

  get relativeEntries() {
    const standings = this.standings;
    const carPositions = this.root.telemetry.carPositions;

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
    const currentKeys = new Set<number>();

    for (const entry of frame.entries) {
      currentKeys.add(entry.carIdx);

      if (!this.startPositionSnapshot.has(entry.carIdx) && entry.position > 0) {
        this.startPositionSnapshot.set(entry.carIdx, {
          overall: entry.position,
          class: entry.classPosition,
        });
      }

      // Update pit state tracking
      const prev = this.driverPitStates.get(entry.carIdx);

      if (!entry.onPitRoad) {
        this.driverPitStates.set(entry.carIdx, 'none');
      } else if (prev === undefined || prev === 'none') {
        if (entry.trackSurface === 'InPitStall') {
          this.driverPitStates.set(entry.carIdx, 'stall');
        } else {
          this.driverPitStates.set(entry.carIdx, 'in');
        }
      } else if (prev === 'in') {
        if (entry.trackSurface === 'InPitStall') {
          this.driverPitStates.set(entry.carIdx, 'stall');
        }
      } else if (prev === 'stall') {
        if (
          entry.trackSurface === 'AproachingPits' ||
          entry.trackSurface === 'OnTrack'
        ) {
          this.driverPitStates.set(entry.carIdx, 'exit');
        }
      }
    }

    // Clean up old driver entries that are no longer active
    for (const key of this.driverPitStates.keys()) {
      if (!currentKeys.has(key)) {
        this.driverPitStates.delete(key);
      }
    }

    this.standings = frame;
  }

  get qualifyStartPosMap() {
    const results =
      this.root.telemetry.sessionInfo?.QualifyResultsInfo?.Results;

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
    this.driverPitStates.clear();
  }
}
