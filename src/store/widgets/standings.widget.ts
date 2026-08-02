import {
  makeAutoObservable,
  reaction,
  runInAction,
  type IReactionDisposer,
} from 'mobx';

import type { DriverEntry } from '@/types/bindings';
import type { DriverGroup } from '@/types';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { computeClassSof } from '@utils/widget/standings-utils';
import { MOVE_DURATION_MS } from '@/hooks/common/useRowMoveAnimation';
import type { RootStore } from '@store/root-store';

export type PositionChangeDirection = 'up' | 'down';

// Fallback lifetime of the arrow: it normally clears once the row has finished
// moving, but a swap that keeps flapping never settles, so it must expire anyway.
const POSITION_CHANGE_MAX_MS = 3000;

// The arrow lingers for this long after the row has slid into its new place.
const ARROW_LINGER_MS = 400;

// A swap must hold this long before the rows are allowed to trade places. Cars
// side by side in a fight (and the whole field on the opening lap) exchange
// live positions several times a second, which would otherwise shake the table.
const ORDER_SETTLE_MS = 900;

const MS_PER_SECOND = 1000;

// Scroll key for the view modes that draw a single list. Real class ids are
// positive, so it can never collide with one.
export const SINGLE_LIST_SCROLL_KEY = -1;

type PendingPosition = { position: number; since: number };

export class StandingsWidgetStore {
  activeClassIndex = 0;

  /**
   * Rows each list is scrolled down by, away from the automatic view, keyed by
   * class id — grouped view draws every class as its own list and scrolls them
   * independently. `SINGLE_LIST_SCROLL_KEY` holds the one list the other view
   * modes draw. A missing or zero entry means the automatic view is in charge
   * again (leaders on top plus the player window).
   */
  scrollOffsets = new Map<number, number>();

  /** Largest offset per list that still fills it — published by the rendered rows. */
  private scrollBounds = new Map<number, number>();

  /**
   * First class the grouped view draws. Classes past the widget height are simply
   * cut off, so scrolling past the end of the top class raises this instead and
   * brings the hidden ones into view.
   */
  groupScrollIndex = 0;

  /** Every class in drawing order, drawn or cut off — published with the bounds. */
  private groupKeys: number[] = [];

  /**
   * Class whose drivers the cursor sits on in grouped view, so the rows about to be
   * scrolled can say so. Null while the cursor is not on any driver row.
   */
  hoveredClassId: number | null = null;

  /** Cursor is on a class header, where the wheel moves the classes themselves. */
  isClassScrollHovered = false;

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

  private scrollResetTimer: ReturnType<typeof setTimeout> | null = null;

  // Wired in the constructor rather than an init() step: the arrows compare
  // consecutive telemetry frames, so the very first frame must already be seen.
  constructor(private readonly root: RootStore) {
    makeAutoObservable<
      StandingsWidgetStore,
      | 'previousPositions'
      | 'pendingPositions'
      | 'changeTimers'
      | 'disposers'
      | 'scrollBounds'
      | 'groupKeys'
      | 'scrollResetTimer'
    >(
      this,
      {
        previousPositions: false,
        pendingPositions: false,
        changeTimers: false,
        disposers: false,
        scrollBounds: false,
        groupKeys: false,
        scrollResetTimer: false,
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

    // A different class or view mode means a different list of rows, so the
    // offset collected for the previous one no longer points anywhere sensible.
    this.disposers.push(
      reaction(
        () => [
          this.activeClassIndex,
          this.root.widgetSettings.getSettings<StandingsWidgetSettings>(
            'standings'
          ).viewMode,
        ],
        () => this.resetScroll()
      )
    );

    // Switching the ranking source rebuilds the whole table at once, so the
    // settle debounce is dropped instead of dragging every row through it.
    this.disposers.push(
      reaction(
        () => this.useTrackOrder,
        () => {
          this.settledPositions = new Map();
          this.pendingPositions.clear();
          this.previousPositions.clear();
        }
      )
    );
  }

  /**
   * Whether the table ranks by position on track rather than by the official
   * order, in every session type alike. Outside a race the official order ranks
   * by best lap, so the two are genuinely different answers there.
   */
  get useTrackOrder(): boolean {
    return this.root.widgetSettings.getSettings<StandingsWidgetSettings>(
      'standings'
    ).useLivePositions;
  }

  /** Rank a car holds under the active ordering — overall. */
  rankOf(entry: DriverEntry): number {
    return this.useTrackOrder ? entry.livePosition : entry.position;
  }

  /** Rank a car holds under the active ordering — within its class. */
  classRankOf(entry: DriverEntry): number {
    return this.useTrackOrder ? entry.liveClassPosition : entry.classPosition;
  }

  get playerEntry(): DriverEntry | null {
    return (
      this.root.backendComputed.standings?.entries.find(
        (entry) => entry.isPlayer
      ) ?? null
    );
  }

  /**
   * Player's overall position for the readouts outside the table. Live follows the
   * on-track order, official is the sim's own number, which only refreshes at the
   * start/finish line. Falls back to the official one whenever the standings frame
   * has no entry for the player yet. Callers pass their own widget's flag — this
   * readout is not tied to the standings table's own setting.
   */
  playerPosition(useLivePositions: boolean): number | null {
    const official = this.root.player.lapTiming?.player_car_position ?? null;

    if (!useLivePositions) {
      return official;
    }

    const entry = this.playerEntry;

    if (!entry) {
      return official;
    }

    return entry.livePosition || official;
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

    this.clearScrollReset();

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
        next.set(entry.carIdx, this.rankOf(entry));
        this.pendingPositions.delete(entry.carIdx);
        changed = true;
        continue;
      }

      if (settled === this.rankOf(entry)) {
        this.pendingPositions.delete(entry.carIdx);
        continue;
      }

      const pending = this.pendingPositions.get(entry.carIdx);

      if (!pending || pending.position !== this.rankOf(entry)) {
        this.pendingPositions.set(entry.carIdx, {
          position: this.rankOf(entry),
          since: now,
        });
        continue;
      }

      if (now - pending.since >= ORDER_SETTLE_MS) {
        next.set(entry.carIdx, this.rankOf(entry));
        this.pendingPositions.delete(entry.carIdx);
        this.clearArrowAfterMove(entry.carIdx);
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

  // Arrows read the raw frame, not the settled order: the flash is the instant
  // signal that a place changed hands, while the row itself only slides once the
  // swap has held.
  private trackPositionChanges(entries: DriverEntry[]) {
    for (const entry of entries) {
      const previous = this.previousPositions.get(entry.carIdx);
      const current = this.rankOf(entry);

      this.previousPositions.set(entry.carIdx, current);

      if (previous === undefined || previous === current) {
        continue;
      }

      this.flashPositionChange(
        entry.carIdx,
        current < previous ? 'up' : 'down'
      );
    }
  }

  /**
   * Cars the sim classified as retired or disqualified, dropped when the user asked
   * for it. The player's own row always stays — the widget is unusable without it.
   */
  private get visibleEntries(): DriverEntry[] {
    const entries = this.root.backendComputed.standings?.entries ?? [];

    const hideRetired =
      this.root.widgetSettings.getSettings<StandingsWidgetSettings>(
        'standings'
      ).hideRetiredDrivers;

    if (!hideRetired) {
      return entries;
    }

    return entries.filter((entry) => !entry.isRetired || entry.isPlayer);
  }

  /** Field ordered by the debounced positions — the order the table renders. */
  get orderedEntries(): DriverEntry[] {
    const entries = this.visibleEntries;

    const positions = this.settledPositions;

    return [...entries].sort(
      (a, b) =>
        (positions.get(a.carIdx) ?? this.rankOf(a)) -
        (positions.get(b.carIdx) ?? this.rankOf(b))
    );
  }

  /**
   * Rank each car holds in the table as it is currently drawn — derived from the
   * settled order rather than the raw frame, so the ± column flips at the moment
   * the row changes places instead of ahead of it.
   */
  get renderedRanks(): Map<number, { overall: number; inClass: number }> {
    const result = new Map<number, { overall: number; inClass: number }>();
    const classCounts = new Map<number, number>();

    this.orderedEntries.forEach((entry, index) => {
      const inClass = (classCounts.get(entry.carClassId) ?? 0) + 1;

      classCounts.set(entry.carClassId, inClass);
      result.set(entry.carIdx, { overall: index + 1, inClass });
    });

    return result;
  }

  private flashPositionChange(
    carIdx: number,
    direction: PositionChangeDirection
  ) {
    this.positionChanges.set(carIdx, direction);
    this.clearChangeAfter(carIdx, POSITION_CHANGE_MAX_MS);
  }

  // The row starts sliding on the render that follows the settle, so the arrow
  // is given the move duration plus a short tail before it hands the cell back
  // to the position number.
  private clearArrowAfterMove(carIdx: number) {
    if (!this.positionChanges.has(carIdx)) {
      return;
    }

    this.clearChangeAfter(carIdx, MOVE_DURATION_MS + ARROW_LINGER_MS);
  }

  private clearChangeAfter(carIdx: number, delayMs: number) {
    const running = this.changeTimers.get(carIdx);

    if (running) {
      clearTimeout(running);
    }

    this.changeTimers.set(
      carIdx,
      setTimeout(() => {
        runInAction(() => {
          this.positionChanges.delete(carIdx);
          this.changeTimers.delete(carIdx);
        });
      }, delayMs)
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
      if (this.classRankOf(entry) === 1) {
        result.set(entry.carClassId, entry);
      }
    }

    return result;
  }

  get overallLeader(): DriverEntry | null {
    if (!this.root.backendComputed.standings) return null;

    return (
      this.root.backendComputed.standings.entries.find(
        (entry) => this.rankOf(entry) === 1
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

    const playerClassId = this.playerEntry?.carClassId ?? null;

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

  setScrollHover(classId: number | null, onClassHeader = false) {
    this.hoveredClassId = classId;
    this.isClassScrollHovered = onClassHeader;
  }

  /**
   * Moves the classes themselves — the class at the top leaves and the next one,
   * including the ones cut off by the widget height, takes its place. The class
   * leaving keeps no row offset: it comes back showing its leaders.
   */
  scrollClasses(delta: number) {
    const next = Math.min(
      Math.max(0, this.groupScrollIndex + Math.sign(delta)),
      Math.max(0, this.groupKeys.length - 1)
    );

    if (next === this.groupScrollIndex) {
      return;
    }

    if (next > this.groupScrollIndex) {
      // Taken from the published order, not from the drawn bounds: two scrolls
      // before the next commit would otherwise drop the same class twice.
      const leavingKey = this.groupKeys[this.groupScrollIndex];

      if (leavingKey !== undefined) {
        this.scrollOffsets.delete(leavingKey);
      }
    }

    this.groupScrollIndex = next;
    this.armScrollReset();
  }

  scrollOffsetFor(key: number): number {
    return this.scrollOffsets.get(key) ?? 0;
  }

  /** Any list scrolled away from its automatic view. */
  get isScrolled(): boolean {
    if (this.groupScrollIndex > 0) return true;

    for (const offset of this.scrollOffsets.values()) {
      if (offset > 0) return true;
    }

    return false;
  }

  /**
   * Published by the rendered rows every time their number or the field changes —
   * hotkeys fire outside the render tree and have no other way to know the limits.
   * `groupKeys` lists every class, drawn or not, so the scroll knows there are
   * more classes waiting below the ones that fit the widget.
   */
  setScrollBounds(bounds: Map<number, number>, groupKeys: number[] = []) {
    this.scrollBounds = bounds;
    this.groupKeys = groupKeys;

    if (this.groupScrollIndex >= groupKeys.length) {
      this.groupScrollIndex = Math.max(0, groupKeys.length - 1);
    }

    for (const [key, offset] of this.scrollOffsets) {
      const bound = bounds.get(key) ?? 0;

      if (offset > bound) {
        this.scrollOffsets.set(key, bound);
      }
    }
  }

  /**
   * Scrolls one list. `key` is the class the cursor sits on; without one — hotkeys,
   * or a cursor between the rows — the lists scroll in turn instead, so every class
   * stays reachable when there is nothing to point at.
   */
  scrollByRows(delta: number, key?: number) {
    if (key === undefined) {
      this.scrollListsInTurn(delta);

      return;
    }

    const current = this.scrollOffsetFor(key);
    const bound = this.scrollBounds.get(key) ?? 0;
    const next = Math.min(Math.max(0, current + delta), bound);

    if (next === current) {
      return;
    }

    this.scrollOffsets.set(key, next);
    this.armScrollReset();
  }

  /**
   * Walks the classes one at a time: the class on top scrolls through its own
   * drivers, and once it runs out the whole table shifts up a class, bringing the
   * next one — including the ones that never fit the widget height — to the top.
   * Scrolling back unwinds the same path.
   */
  private scrollListsInTurn(delta: number) {
    const topKey = Array.from(this.scrollBounds.keys())[0];

    if (topKey === undefined) {
      return;
    }

    const current = this.scrollOffsetFor(topKey);
    const room =
      delta < 0 ? current : (this.scrollBounds.get(topKey) ?? 0) - current;

    const taken = Math.min(Math.abs(delta), Math.max(0, room));

    if (taken > 0) {
      this.scrollOffsets.set(topKey, current + (delta < 0 ? -taken : taken));
      this.armScrollReset();

      return;
    }

    // The top class has nothing left to give, so the classes themselves move.
    this.scrollClasses(delta);
  }

  resetScroll() {
    this.clearScrollReset();
    this.scrollOffsets.clear();
    this.groupScrollIndex = 0;
  }

  private armScrollReset() {
    this.clearScrollReset();

    const resetSeconds =
      this.root.widgetSettings.getSettings<StandingsWidgetSettings>(
        'standings'
      ).scrollResetSeconds;

    if (!this.isScrolled || resetSeconds <= 0) {
      return;
    }

    this.scrollResetTimer = setTimeout(() => {
      runInAction(() => {
        this.scrollOffsets.clear();
        this.groupScrollIndex = 0;
        this.scrollResetTimer = null;
      });
    }, resetSeconds * MS_PER_SECOND);
  }

  private clearScrollReset() {
    if (this.scrollResetTimer !== null) {
      clearTimeout(this.scrollResetTimer);
      this.scrollResetTimer = null;
    }
  }
}
