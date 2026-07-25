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

// A swap must hold this long before the rows are allowed to trade places. Cars
// side by side in a fight (and the whole field on the opening lap) exchange
// live positions several times a second, which would otherwise shake the table.
const ORDER_SETTLE_MS = 900;

type PendingPosition = { position: number; since: number };

export class StandingsWidgetStore {
  activeClassIndex = 0;

  /** carIdx → direction of the position change currently being flashed. */
  positionChanges = new Map<number, PositionChangeDirection>();

  /** carIdx → position the table is currently drawn with (debounced). */
  private settledPositions = new Map<number, number>();

  private readonly pendingPositions = new Map<number, PendingPosition>();

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
      'previousPositions' | 'pendingPositions' | 'changeTimers' | 'disposers'
    >(
      this,
      {
        previousPositions: false,
        pendingPositions: false,
        changeTimers: false,
        disposers: false,
      },
      { autoBind: true }
    );

    this.disposers.push(
      reaction(
        () => this.root.backendComputed.standings,
        (frame) => {
          const entries = frame?.entries ?? [];

          this.settleOrder(entries);
          this.trackPositionChanges(entries);
        }
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
    this.pendingPositions.clear();
    this.settledPositions = new Map();
  }

  // Holds back a car's new position until it has survived ORDER_SETTLE_MS, so
  // the table only reorders once a pass has actually stuck. Cars seen for the
  // first time settle immediately — the opening order must not fade in.
  private settleOrder(entries: DriverEntry[]) {
    const now = performance.now();
    const next = new Map(this.settledPositions);
    const seen = new Set<number>();
    let changed = false;

    for (const entry of entries) {
      seen.add(entry.carIdx);

      const settled = next.get(entry.carIdx);

      if (settled === undefined) {
        next.set(entry.carIdx, entry.livePosition);
        this.pendingPositions.delete(entry.carIdx);
        changed = true;
        continue;
      }

      if (settled === entry.livePosition) {
        this.pendingPositions.delete(entry.carIdx);
        continue;
      }

      const pending = this.pendingPositions.get(entry.carIdx);

      if (!pending || pending.position !== entry.livePosition) {
        this.pendingPositions.set(entry.carIdx, {
          position: entry.livePosition,
          since: now,
        });
        continue;
      }

      if (now - pending.since >= ORDER_SETTLE_MS) {
        next.set(entry.carIdx, entry.livePosition);
        this.pendingPositions.delete(entry.carIdx);
        changed = true;
      }
    }

    for (const carIdx of next.keys()) {
      if (!seen.has(carIdx)) {
        next.delete(carIdx);
        this.pendingPositions.delete(carIdx);
        changed = true;
      }
    }

    if (changed) {
      this.settledPositions = next;
    }
  }

  // Arrows follow the settled order, not the raw frame, so the flash and the
  // row sliding into its new place happen together.
  private trackPositionChanges(entries: DriverEntry[]) {
    for (const entry of entries) {
      const position = this.settledPositions.get(entry.carIdx);

      if (position === undefined) {
        continue;
      }

      const previous = this.previousPositions.get(entry.carIdx);

      this.previousPositions.set(entry.carIdx, position);

      if (previous === undefined || previous === position) {
        continue;
      }

      this.flashPositionChange(
        entry.carIdx,
        position < previous ? 'up' : 'down'
      );
    }
  }

  /** Field ordered by the debounced positions — the order the table renders. */
  get orderedEntries(): DriverEntry[] {
    const entries = this.root.backendComputed.standings?.entries ?? [];

    const positions = this.settledPositions;

    return [...entries].sort(
      (a, b) =>
        (positions.get(a.carIdx) ?? a.livePosition) -
        (positions.get(b.carIdx) ?? b.livePosition)
    );
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
    const entries = this.orderedEntries;

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
          // Already in settled overall order, which within a class is the class order.
          drivers: driversInClass,
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
