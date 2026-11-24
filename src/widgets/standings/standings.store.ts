import {
  makeAutoObservable,
  reaction,
  type IReactionDisposer,
  compareStructural,
} from 'mobx';

import type { CarIdentity } from '@shared/contracts/car-identity';
import type { DriverGroup } from '@shared/contracts/domain';
import { computeClassSof, hasSetALap } from '@shared/lib/driver';
import { hasRaceStarted } from '@shared/lib/timer-utils';
import type { WidgetInstanceContext } from '@entities/widget/widget-instances.store';
import type { StandingsHotkeyTarget } from '@features/hotkey-bindings/hotkey-targets';
import { useWidgetInstanceStore } from '@entities/widget/widget-instance-context';
import type { BackendComputedStore } from '@entities/cars/computed.store';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { SessionStore } from '@entities/session/session.store';
import type { PlayerPositionStore } from '@entities/player/player-position.store';
import type { StandingsWidgetSettings } from './settings-schema';
import { StandingsScrollStore } from './standings-scroll.store';
import {
  StandingsOrderStore,
  compareRanks,
  type Rank,
} from './standings-order.store';

interface StandingsDeps {
  backendComputed: BackendComputedStore;
  liveWidgets: LiveWidgetsView;
  session: SessionStore;
  playerPosition: PlayerPositionStore;
}

const OVERALL_REFERENCE = -1;

type SeenLap = {
  lap: number;
  time: number | null;
  previousTime: number | null;
  crossedInPit: boolean;
};

/**
 * One standings table: its class tab, scroll, settle debounce and position
 * flashes. Built per instance by `mount.ts`, so two tables keep their own
 * place and a table that is not on screen runs nothing.
 */
export class StandingsWidgetStore implements StandingsHotkeyTarget {
  activeClassIndex = 0;

  readonly scroll = new StandingsScrollStore(
    () => this.settings.scrollResetSeconds
  );

  private readonly order = new StandingsOrderStore();

  /**
   * carIdx → last lap minus the lap before it. The sim keeps only the last lap
   * of each car, so the one before is whatever this table saw last — a car
   * gets its first delta on the second lap completed while the table is open.
   */
  lapDeltas = new Map<number, number>();

  private readonly seenLapTimes = new Map<number, SeenLap>();

  private readonly disposers: IReactionDisposer[] = [];

  private readonly root: StandingsDeps;

  private readonly instanceId: string;

  // Wired in the constructor rather than an init() step: the arrows compare
  // consecutive telemetry frames, so the very first frame must already be seen.
  constructor({ core, instanceId }: WidgetInstanceContext<StandingsDeps>) {
    this.root = core;
    this.instanceId = instanceId;

    makeAutoObservable<
      StandingsWidgetStore,
      'root' | 'order' | 'seenLapTimes' | 'disposers'
    >(
      this,
      {
        root: false,
        order: false,
        scroll: false,
        seenLapTimes: false,
        disposers: false,
      },
      { autoBind: true }
    );

    this.disposers.push(
      reaction(
        () =>
          [
            this.root.backendComputed.driverEntries,
            this.root.backendComputed.driverIdentities,
          ] as const,
        ([, entries], previous) => {
          const identitiesChanged = entries !== previous?.[1];

          if (!identitiesChanged && !this.order.hasPending()) {
            return;
          }

          this.order.process(
            identitiesChanged ? entries : null,
            this.useTrackOrder,
            performance.now()
          );

          if (identitiesChanged) {
            this.trackLapDeltas(entries);
          }
        },
        { fireImmediately: true }
      )
    );

    // Lap times of another session say nothing about this one's laps.
    this.disposers.push(
      reaction(
        () => this.root.session.sessionInfo?.currentSessionNum,
        () => this.resetLapDeltas()
      )
    );

    // A different class or view mode means a different list of rows, so the
    // offset collected for the previous one no longer points anywhere sensible.
    this.disposers.push(
      reaction(
        () => [this.activeClassIndex, this.settings.viewMode],
        () => this.scroll.resetScroll()
      )
    );

    // Switching the ranking source rebuilds the whole table at once, so the
    // settle debounce is dropped instead of dragging every row through it.
    this.disposers.push(
      reaction(
        () => this.useTrackOrder,
        () => this.order.reset()
      )
    );

    // The backend swaps how it ranks the field at these two moments — a new
    // session, and the green flag turning the starting grid into track order.
    // Every row changes rank at once, which is a rebuild rather than a series of
    // overtakes; without the reset the debounce drags the table through it row
    // by row, and a session that stops emitting frames freezes half-way.
    this.disposers.push(
      reaction(
        () => [
          this.root.session.sessionInfo?.currentSessionNum,
          hasRaceStarted(this.root.session.session?.session_state ?? null),
        ],
        () => this.order.reset(),
        { equals: compareStructural }
      )
    );
  }

  /**
   * Whether the table ranks by position on track rather than by the official
   * order, in every session type alike. Outside a race the official order ranks
   * by best lap, so the two are genuinely different answers there.
   */
  get useTrackOrder(): boolean {
    return this.settings.useLivePositions;
  }

  /** This instance's own settings — two tables may rank and filter differently. */
  get settings(): StandingsWidgetSettings {
    return this.root.liveWidgets.getSettings<StandingsWidgetSettings>(
      this.instanceId
    );
  }

  /** Rank a car holds under the active ordering — overall. */
  rankOf(entry: CarIdentity): number {
    return this.useTrackOrder ? entry.livePosition : entry.position;
  }

  /** Rank a car holds under the active ordering — within its class. */
  classRankOf(entry: CarIdentity): number {
    return this.useTrackOrder ? entry.liveClassPosition : entry.classPosition;
  }

  // Called when the instance unmounts; the reactions and timers otherwise
  // outlive it and keep running against telemetry.
  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;

    this.order.dispose();
    this.scroll.resetScroll();
    this.resetLapDeltas();
  }

  private trackLapDeltas(entries: CarIdentity[]) {
    for (const entry of entries) {
      const seen = this.seenLapTimes.get(entry.carIdx);

      // The lap counter can drop when a car leaves the world and the
      // backend falls back to the official completed-lap count.
      if (seen && entry.lap < seen.lap) {
        continue;
      }

      const sameLap = seen?.lap === entry.lap;
      const consecutiveLap = seen && entry.lap === seen.lap + 1;
      const previousTime = sameLap
        ? seen.previousTime
        : consecutiveLap
          ? seen.time
          : null;
      const crossedInPit = sameLap ? seen.crossedInPit : entry.onPitRoad;
      // At a pit-lane crossing iRacing can keep reporting the previous lap's
      // time before clearing it, including when the driver serves a penalty.
      const lapTime =
        crossedInPit && entry.lastLapTime === previousTime
          ? null
          : entry.lastLapTime;

      if (sameLap && lapTime === seen.time) {
        continue;
      }

      if (lapTime !== null && previousTime !== null) {
        this.lapDeltas.set(entry.carIdx, lapTime - previousTime);
      } else {
        this.lapDeltas.delete(entry.carIdx);
      }

      this.seenLapTimes.set(entry.carIdx, {
        lap: entry.lap,
        time: lapTime,
        previousTime,
        crossedInPit,
      });
    }
  }

  private resetLapDeltas() {
    this.seenLapTimes.clear();
    this.lapDeltas.clear();
  }

  /**
   * carIdx → the car drawn directly above it in the table's reference — the
   * whole field in the overall view, the car's own class in the others. The
   * first car of a reference has no entry.
   */
  get carAheadMap(): Map<number, number> {
    const byClass = this.settings.viewMode !== 'all';
    const result = new Map<number, number>();
    const lastSeenByReference = new Map<number, number>();

    for (const entry of this.orderedEntries) {
      const reference = byClass ? entry.carClassId : OVERALL_REFERENCE;
      const ahead = lastSeenByReference.get(reference);

      if (ahead !== undefined) {
        result.set(entry.carIdx, ahead);
      }

      lastSeenByReference.set(reference, entry.carIdx);
    }

    return result;
  }

  /**
   * Cars the sim classified as retired or disqualified, and — in the timed
   * sessions — cars still without a lap, dropped when the user asked for it. The
   * player's own row always stays: the widget is unusable without it.
   */
  private get visibleEntries(): CarIdentity[] {
    const entries = this.root.backendComputed.driverIdentities;

    const settings = this.settings;

    const sessionType = this.root.session.currentSessionType;

    // A race orders itself by position, so an unset lap says nothing there —
    // only practice and qualifying rank by the clock.
    const hideLapless =
      settings.hideDriversWithoutLap &&
      (sessionType === 'Practice' || sessionType === 'Qualify');

    if (!settings.hideRetiredDrivers && !hideLapless) {
      return entries;
    }

    return entries.filter((entry) => {
      if (entry.isPlayer) {
        return true;
      }

      if (settings.hideRetiredDrivers && entry.isRetired) {
        return false;
      }

      return !hideLapless || hasSetALap(entry);
    });
  }

  /** Field ordered by the debounced positions — the order the table renders. */
  get orderedEntries(): CarIdentity[] {
    const entries = this.visibleEntries;

    // The sort is stable and `visibleEntries` keeps the backend's order, so
    // unplaced cars stay in that order among themselves.
    return [...entries].sort((first, second) =>
      compareRanks(
        this.renderedRankOf(first).overall,
        this.renderedRankOf(second).overall
      )
    );
  }

  /**
   * Rank each car holds in the table as it is currently drawn — derived from the
   * settled order rather than the raw frame, so the ± column flips at the moment
   * the row changes places instead of ahead of it.
   */
  get renderedRanks(): ReadonlyMap<number, Rank> {
    return this.order.renderedRanks;
  }

  get positionChanges() {
    return this.order.positionChanges;
  }

  private renderedRankOf(entry: CarIdentity): Rank {
    return (
      this.renderedRanks.get(entry.carIdx) ?? {
        overall: this.rankOf(entry),
        inClass: this.classRankOf(entry),
      }
    );
  }

  displayedPositionOf(entry: CarIdentity): number {
    const rank = this.renderedRankOf(entry);

    return this.settings.viewMode === 'all' ? rank.overall : rank.inClass;
  }

  projectedIrDeltaOf(carIdx: number): number | null {
    const entry = this.driverMap.get(carIdx);
    const displayed = this.renderedRanks.get(carIdx);

    if (!entry || this.root.session.currentSessionType !== 'Race') {
      return null;
    }

    // The backend scores the current frame. Wait for the displayed rank
    // to catch up before showing the new projection.
    if (
      displayed &&
      (displayed.overall !== this.rankOf(entry) ||
        displayed.inClass !== this.classRankOf(entry))
    ) {
      return null;
    }

    return this.useTrackOrder
      ? entry.estimatedIrDeltaLive
      : entry.estimatedIrDeltaOfficial;
  }

  get driverMap(): Map<number, CarIdentity> {
    return new Map(
      this.root.backendComputed.driverIdentities.map((entry) => [
        entry.carIdx,
        entry,
      ])
    );
  }

  get classLeaders(): Map<number, CarIdentity> {
    const result = new Map<number, CarIdentity>();

    for (const entry of this.root.backendComputed.driverIdentities) {
      if (this.renderedRankOf(entry).inClass !== 1) {
        continue;
      }

      const leader = result.get(entry.carClassId);

      if (
        !leader ||
        compareRanks(
          this.renderedRankOf(entry).overall,
          this.renderedRankOf(leader).overall
        ) < 0
      ) {
        result.set(entry.carClassId, entry);
      }
    }

    return result;
  }

  get overallLeader(): CarIdentity | null {
    return (
      this.root.backendComputed.driverIdentities.find(
        (entry) => this.renderedRankOf(entry).overall === 1
      ) ?? null
    );
  }

  get allClassGroups(): DriverGroup[] {
    const entries = this.orderedEntries;

    if (entries.length === 0) return [];

    const classMap = new Map<number, CarIdentity[]>();

    for (const driver of entries) {
      const existing = classMap.get(driver.carClassId);

      if (existing) {
        existing.push(driver);
      } else {
        classMap.set(driver.carClassId, [driver]);
      }
    }

    const playerClassId =
      this.root.playerPosition.playerEntry?.carClassId ?? null;

    return Array.from(classMap.entries())
      .sort(([a], [b]) => {
        if (playerClassId !== null) {
          if (a === playerClassId) return -1;

          if (b === playerClassId) return 1;
        }

        return a - b;
      })
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

    for (const entry of this.root.backendComputed.driverIdentities) {
      const { bestLapTime } = entry;

      if (bestLapTime === null) continue;

      const current = result.get(entry.carClassId);

      if (current === undefined || bestLapTime < current) {
        result.set(entry.carClassId, bestLapTime);
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

  /** A class hotkey: steps through every class the session has entered. */
  stepClass(direction: number) {
    const totalClasses = this.root.backendComputed.carClassCount;

    if (direction < 0) {
      this.cyclePrev(totalClasses);
    } else {
      this.cycleNext(totalClasses);
    }
  }

  scrollByRows(delta: number) {
    this.scroll.scrollByRows(delta);
  }
}

export const useStandingsWidgetStore = () =>
  useWidgetInstanceStore<StandingsWidgetStore>();
