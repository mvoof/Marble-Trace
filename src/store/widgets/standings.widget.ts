import { makeAutoObservable } from 'mobx';

import type { DriverEntry } from '@/types/bindings';
import type { DriverGroup } from '@/types';
import { computeClassSof } from '@utils/widget/standings-utils';
import type { RootStore } from '@store/root-store';

export class StandingsWidgetStore {
  activeClassIndex = 0;

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
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
      if (entry.classPosition === 1) {
        result.set(entry.carClassId, entry);
      }
    }

    return result;
  }

  get overallLeader(): DriverEntry | null {
    if (!this.root.backendComputed.standings) return null;

    return (
      this.root.backendComputed.standings.entries.find(
        (entry) => entry.position === 1
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
          drivers: driversInClass.sort(
            (a, b) => a.classPosition - b.classPosition
          ),
        };
      });
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
