import { makeAutoObservable, runInAction } from 'mobx';
import {
  scrollThumbFor,
  type ScrollMetrics,
  type ScrollThumb,
} from '@shared/lib/canvas';

const MS_PER_SECOND = 1000;

// Real class IDs are positive. Single-list modes share this key.
export const SINGLE_LIST_SCROLL_KEY = -1;

export class StandingsScrollStore {
  /**
   * Rows each list is scrolled down by, away from the automatic view, keyed by
   * class id — grouped view draws every class as its own list and scrolls them
   * independently. `SINGLE_LIST_SCROLL_KEY` holds the one list the other view
   * modes draw. A missing or zero entry means the automatic view is in charge
   * again (leaders on top plus the player window).
   */
  private readonly scrollOffsets = new Map<number, number>();

  /**
   * Size of every drawn list against the window it is drawn into, keyed the same
   * way as `scrollOffsets` — published by the rendered rows. The largest usable
   * offset and the scrollbar thumb both come out of it.
   */
  private scrollMetrics = new Map<number, ScrollMetrics>();

  /**
   * First class the grouped view draws. Classes past the widget height are simply
   * cut off, so scrolling past the end of the top class raises this instead and
   * brings the hidden ones into view.
   */
  groupScrollIndex = 0;

  /** Every class in drawing order, drawn or cut off — published with the bounds. */
  private groupKeys: number[] = [];

  /** How many classes fit the widget height — published with the bounds. */
  private groupWindowSize = 0;

  /** Group whose metrics were last published by the rendered rows. */
  private boundsGroupScrollIndex = 0;

  /** Row-scroll inputs received while the newly selected group's bounds render. */
  private pendingRowScrollDeltas: number[] = [];

  /**
   * Class whose drivers the cursor sits on in grouped view, so the rows about to be
   * scrolled can say so. Null while the cursor is not on any driver row.
   */
  hoveredClassId: number | null = null;

  /** Cursor is on a class header, where the wheel moves the classes themselves. */
  isClassScrollHovered = false;

  private scrollResetTimer: ReturnType<typeof setTimeout> | null = null;
  private lastScrollAt: number | null = null;

  constructor(private readonly resetSeconds: () => number) {
    makeAutoObservable<
      StandingsScrollStore,
      | 'resetSeconds'
      | 'scrollResetTimer'
      | 'boundsGroupScrollIndex'
      | 'pendingRowScrollDeltas'
    >(
      this,
      {
        resetSeconds: false,
        scrollResetTimer: false,
        boundsGroupScrollIndex: false,
        pendingRowScrollDeltas: false,
      },
      { autoBind: true }
    );
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
    if (this.moveClasses(delta)) {
      this.pendingRowScrollDeltas = [];
      this.armScrollReset();
    }
  }

  private moveClasses(delta: number): boolean {
    const next = Math.min(
      Math.max(0, this.groupScrollIndex + Math.sign(delta)),
      Math.max(0, this.groupKeys.length - 1)
    );

    if (next === this.groupScrollIndex) {
      return false;
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

    return true;
  }

  scrollOffsetFor(key: number): number {
    return this.scrollOffsets.get(key) ?? 0;
  }

  /** Any list scrolled away from its automatic view. */
  get isScrolled(): boolean {
    if (this.groupScrollIndex > 0) {
      return true;
    }

    for (const offset of this.scrollOffsets.values()) {
      if (offset > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Published by the rendered rows every time their number or the field changes —
   * hotkeys fire outside the render tree and have no other way to know the limits.
   * `groupKeys` lists every class, drawn or not, so the scroll knows there are
   * more classes waiting below the ones that fit the widget.
   */
  setScrollBounds(
    metrics: Map<number, ScrollMetrics>,
    groupKeys: number[] = [],
    groupWindowSize = 0,
    renderedGroupScrollIndex = 0
  ) {
    const previousTopKey = this.groupKeys[this.groupScrollIndex];
    this.scrollMetrics = metrics;
    this.groupKeys = groupKeys;
    this.groupWindowSize = groupWindowSize;

    if (this.groupScrollIndex >= groupKeys.length) {
      this.groupScrollIndex = Math.max(0, groupKeys.length - 1);
    }

    if (this.groupKeys[this.groupScrollIndex] !== previousTopKey) {
      this.pendingRowScrollDeltas = [];
    }

    this.boundsGroupScrollIndex = renderedGroupScrollIndex;

    for (const [key, offset] of this.scrollOffsets) {
      const bound = this.boundFor(key);

      if (offset > bound) {
        this.scrollOffsets.set(key, bound);
      }
    }

    while (this.pendingRowScrollDeltas.length > 0) {
      const delta = this.pendingRowScrollDeltas[0];

      if (!this.hasCurrentTopBounds()) {
        break;
      }

      this.pendingRowScrollDeltas.shift();
      this.scrollListsInTurn(delta);
    }
  }

  /** Largest offset for a list that still fills the window it is drawn into. */
  private boundFor(key: number): number {
    const metrics = this.scrollMetrics.get(key);

    if (!metrics) {
      return 0;
    }

    return Math.max(0, metrics.total - metrics.windowSize);
  }

  /** Thumb for one list, or null while all of it is on screen. */
  listThumb(key: number): ScrollThumb | null {
    return scrollThumbFor(
      this.scrollMetrics.get(key),
      this.scrollOffsetFor(key)
    );
  }

  /**
   * Thumb for the classes themselves in grouped view: it tracks which slice of
   * the class list the widget height is showing, not the drivers inside them.
   */
  get groupThumb(): ScrollThumb | null {
    return scrollThumbFor(
      { total: this.groupKeys.length, windowSize: this.groupWindowSize },
      this.groupScrollIndex
    );
  }

  /**
   * Scrolls one list. `key` is the class the cursor sits on; without one — hotkeys,
   * or a cursor between the rows — the lists scroll in turn instead, so every class
   * stays reachable when there is nothing to point at.
   */
  scrollByRows(delta: number, key?: number) {
    if (key === undefined) {
      if (this.scrollListsInTurn(delta)) {
        this.armScrollReset();
      }

      return;
    }

    const current = this.scrollOffsetFor(key);
    const next = Math.min(Math.max(0, current + delta), this.boundFor(key));

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
  private scrollListsInTurn(delta: number): boolean {
    if (this.scrollMetrics.has(SINGLE_LIST_SCROLL_KEY)) {
      return this.scrollList(SINGLE_LIST_SCROLL_KEY, delta);
    }

    const topKey = this.groupKeys[this.groupScrollIndex];

    if (topKey === undefined) {
      return false;
    }

    if (!this.hasCurrentTopBounds()) {
      this.pendingRowScrollDeltas.push(delta);

      return true;
    }

    return this.scrollList(topKey, delta);
  }

  private hasCurrentTopBounds(): boolean {
    const topKey = this.groupKeys[this.groupScrollIndex];

    return (
      this.boundsGroupScrollIndex === this.groupScrollIndex &&
      topKey !== undefined &&
      this.scrollMetrics.has(topKey)
    );
  }

  private scrollList(topKey: number, delta: number): boolean {
    const current = this.scrollOffsetFor(topKey);
    const room = delta < 0 ? current : this.boundFor(topKey) - current;

    const taken = Math.min(Math.abs(delta), Math.max(0, room));

    if (taken > 0) {
      this.scrollOffsets.set(topKey, current + (delta < 0 ? -taken : taken));

      return true;
    }

    // The top class has nothing left to give, so the classes themselves move.
    return this.moveClasses(delta);
  }

  resetScroll() {
    this.clearScrollReset();
    this.lastScrollAt = null;
    this.scrollOffsets.clear();
    this.groupScrollIndex = 0;
    this.pendingRowScrollDeltas = [];
  }

  /** Reapplies the current setting without extending the inactivity period. */
  settingsChanged() {
    this.scheduleScrollReset();
  }

  private armScrollReset() {
    this.lastScrollAt = Date.now();
    this.scheduleScrollReset();
  }

  private scheduleScrollReset() {
    this.clearScrollReset();

    const resetSeconds = this.resetSeconds();

    if (
      (!this.isScrolled && this.pendingRowScrollDeltas.length === 0) ||
      resetSeconds <= 0 ||
      this.lastScrollAt === null
    ) {
      return;
    }

    const remainingMs = Math.max(
      0,
      resetSeconds * MS_PER_SECOND - (Date.now() - this.lastScrollAt)
    );

    this.scrollResetTimer = setTimeout(() => {
      runInAction(() => {
        this.resetScroll();
      });
    }, remainingMs);
  }

  private clearScrollReset() {
    if (this.scrollResetTimer !== null) {
      clearTimeout(this.scrollResetTimer);
      this.scrollResetTimer = null;
    }
  }
}
