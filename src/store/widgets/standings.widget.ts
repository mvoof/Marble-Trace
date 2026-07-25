import {
  makeAutoObservable,
  reaction,
  runInAction,
  type IReactionDisposer,
} from 'mobx';

import type { DriverEntry } from '@/types/bindings';
import type { DriverGroup } from '@/types';
import { computeClassSof } from '@utils/widget/standings-utils';
import type { RootStore } from '@store/root-store';

export type PositionChangeDirection = 'up' | 'down';

// How long the arrow replaces the position number after a car gains or loses a place.
const POSITION_CHANGE_DURATION_MS = 3000;

export class StandingsWidgetStore {
  activeClassIndex = 0;

  /** carIdx → direction of the position change currently being flashed. */
  positionChanges = new Map<number, PositionChangeDirection>();

  private readonly previousPositions = new Map<number, number>();

  private readonly changeTimers = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();

  private readonly disposers: IReactionDisposer[] = [];

  // Wired in the constructor rather than an init() step: the arrows compare
  // consecutive telemetry frames, so the very first frame must already be seen.
  constructor(private readonly root: RootStore) {
    makeAutoObservable<
      StandingsWidgetStore,
      'previousPositions' | 'changeTimers' | 'disposers'
    >(
      this,
      { previousPositions: false, changeTimers: false, disposers: false },
      { autoBind: true }
    );

    this.disposers.push(
      reaction(
        () => this.root.backendComputed.standings,
        (frame) => this.trackPositionChanges(frame?.entries ?? [])
      )
    );
  }

  // Every RootStore instance (main window, overlay window, each isolated widget
  // preview) creates its own reaction and timers; without this they outlive the store.
  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;

    for (const timer of this.changeTimers.values()) {
      clearTimeout(timer);
    }

    this.changeTimers.clear();
    this.positionChanges.clear();
    this.previousPositions.clear();
  }

  private trackPositionChanges(entries: DriverEntry[]) {
    for (const entry of entries) {
      const previous = this.previousPositions.get(entry.carIdx);

      this.previousPositions.set(entry.carIdx, entry.livePosition);

      if (previous === undefined || previous === entry.livePosition) {
        continue;
      }

      this.flashPositionChange(
        entry.carIdx,
        entry.livePosition < previous ? 'up' : 'down'
      );
    }
  }

  private flashPositionChange(
    carIdx: number,
    direction: PositionChangeDirection
  ) {
    const running = this.changeTimers.get(carIdx);

    if (running) {
      clearTimeout(running);
    }

    this.positionChanges.set(carIdx, direction);

    this.changeTimers.set(
      carIdx,
      setTimeout(() => {
        runInAction(() => {
          this.positionChanges.delete(carIdx);
          this.changeTimers.delete(carIdx);
        });
      }, POSITION_CHANGE_DURATION_MS)
    );
  }

  get driverMap(): Map<number, DriverEntry> {
    if (!this.root.backendComputed.standings) return new Map();

    return new Map(
      this.root.backendComputed.standings.entries.map((entry) => [
        entry.carIdx,
        entry,
      ])
    );
  }

  get classLeaders(): Map<number, DriverEntry> {
    const result = new Map<number, DriverEntry>();

    if (!this.root.backendComputed.standings) return result;

    for (const entry of this.root.backendComputed.standings.entries) {
      if (entry.liveClassPosition === 1) {
        result.set(entry.carClassId, entry);
      }
    }

    return result;
  }

  get overallLeader(): DriverEntry | null {
    if (!this.root.backendComputed.standings) return null;

    return (
      this.root.backendComputed.standings.entries.find(
        (entry) => entry.livePosition === 1
      ) ?? null
    );
  }

  get allClassGroups(): DriverGroup[] {
    const entries = this.root.backendComputed.standings?.entries ?? [];

    if (entries.length === 0) return [];

    const classMap = new Map<number, DriverEntry[]>();

    for (const driver of entries) {
      const existing = classMap.get(driver.carClassId);

      if (existing) {
        existing.push(driver);
      } else {
        classMap.set(driver.carClassId, [driver]);
      }
    }

    return Array.from(classMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([classId, driversInClass]) => {
        const first = driversInClass[0];

        return {
          classId,
          className: first.carClassShortName,
          classShortName: first.carClassShortName,
          classColor: first.carClassColor,
          totalDrivers: driversInClass.length,
          classSof: computeClassSof(driversInClass),
          windowStartIndex: -1,
          drivers: driversInClass.sort(
            (a, b) => a.liveClassPosition - b.liveClassPosition
          ),
        };
      });
  }

  // Best lap time per class — used to highlight the class best-lap holder.
  get classBestLapMap(): Map<number, number> {
    const result = new Map<number, number>();

    if (!this.root.backendComputed.standings) return result;

    for (const entry of this.root.backendComputed.standings.entries) {
      if (!(entry.bestLapTime > 0)) continue;

      const current = result.get(entry.carClassId);

      if (current === undefined || entry.bestLapTime < current) {
        result.set(entry.carClassId, entry.bestLapTime);
      }
    }

    return result;
  }

  clampActiveClassIndex(totalClasses: number) {
    if (totalClasses > 0 && this.activeClassIndex >= totalClasses) {
      this.activeClassIndex = Math.max(0, totalClasses - 1);
    }
  }

  cyclePrev(totalClasses: number) {
    if (totalClasses <= 1) {
      return;
    }

    const clamped = Math.min(this.activeClassIndex, totalClasses - 1);

    this.activeClassIndex = clamped === 0 ? totalClasses - 1 : clamped - 1;
  }

  cycleNext(totalClasses: number) {
    if (totalClasses <= 1) {
      return;
    }

    const clamped = Math.min(this.activeClassIndex, totalClasses - 1);

    this.activeClassIndex = clamped === totalClasses - 1 ? 0 : clamped + 1;
  }
}
