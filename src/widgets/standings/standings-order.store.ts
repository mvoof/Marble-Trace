import { makeAutoObservable, runInAction } from 'mobx';
import type { CarIdentity } from '@shared/contracts/car-identity';
import { MOVE_DURATION_MS } from '@shared/lib/animation';

const ORDER_SETTLE_MS = 900;
const POSITION_CHANGE_MAX_MS = 3000;
const ARROW_LINGER_MS = 400;

export type Rank = { overall: number; inClass: number };
type PositionChangeDirection = 'up' | 'down';
type PendingPosition = { rank: Rank; since: number };

const sameRank = (first: Rank, second: Rank): boolean =>
  first.overall === second.overall && first.inClass === second.inClass;

const rankKeys = (rank: Rank, classId: number): string[] => {
  const keys: string[] = [];

  if (rank.overall > 0) {
    keys.push(String(rank.overall));
  }

  if (rank.inClass > 0) {
    keys.push(`${classId}:${rank.inClass}`);
  }

  return keys;
};

const readRank = (entry: CarIdentity, useTrackOrder: boolean): Rank =>
  useTrackOrder
    ? { overall: entry.livePosition, inClass: entry.liveClassPosition }
    : { overall: entry.position, inClass: entry.classPosition };

// A rank of zero or below is a car the sim has not placed yet (no lap in
// qualifying). It sorts after every placed car instead of above the leader.
const isPlaced = (rank: number): boolean => rank > 0;

export const compareRanks = (first: number, second: number): number => {
  if (isPlaced(first) && isPlaced(second)) {
    return first - second;
  }

  if (isPlaced(first)) {
    return -1;
  }

  if (isPlaced(second)) {
    return 1;
  }

  return 0;
};

/** Debounced ranks and position arrows for one standings table. */
export class StandingsOrderStore {
  readonly positionChanges = new Map<number, PositionChangeDirection>();
  private readonly settled = new Map<number, Rank>();
  private readonly pending = new Map<number, PendingPosition>();
  private readonly classIds = new Map<number, number>();
  private readonly occupants = new Map<string, number>();
  private readonly previousPositions = new Map<number, number>();
  private readonly changeTimers = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();

  constructor() {
    makeAutoObservable<
      StandingsOrderStore,
      | 'pending'
      | 'classIds'
      | 'occupants'
      | 'previousPositions'
      | 'changeTimers'
    >(this, {
      pending: false,
      classIds: false,
      occupants: false,
      previousPositions: false,
      changeTimers: false,
    });
  }

  get renderedRanks(): ReadonlyMap<number, Rank> {
    return this.settled;
  }

  hasPending(): boolean {
    return this.pending.size > 0;
  }

  /** A motion-only frame can finish a pass without scanning the field again. */
  process(entries: CarIdentity[] | null, useTrackOrder: boolean, now: number) {
    if (entries) {
      this.updateOrder(entries, useTrackOrder, now);
    }

    this.settlePending(now);

    if (entries) {
      this.trackPositionChanges(entries, useTrackOrder);
    }
  }

  reset() {
    this.clearRanks();
    this.previousPositions.clear();
  }

  dispose() {
    for (const timer of this.changeTimers.values()) {
      clearTimeout(timer);
    }

    this.changeTimers.clear();
    this.positionChanges.clear();
    this.reset();
  }

  private clearRanks() {
    this.settled.clear();
    this.pending.clear();
    this.classIds.clear();
    this.occupants.clear();
  }

  private updateOrder(
    entries: CarIdentity[],
    useTrackOrder: boolean,
    now: number
  ) {
    const next = new Map(
      entries.map((entry) => [
        entry.carIdx,
        { rank: readRank(entry, useTrackOrder), classId: entry.carClassId },
      ])
    );

    for (const [carIdx, rank] of this.settled) {
      if (!next.has(carIdx)) {
        this.releaseRanks(carIdx, rank);
        this.settled.delete(carIdx);
        this.classIds.delete(carIdx);
        this.pending.delete(carIdx);
      }
    }

    for (const [carIdx, { rank, classId }] of next) {
      const settled = this.settled.get(carIdx);

      // Grid changes can put a newly placed car into a slot held by the old
      // order. Publish the new field together so its first rank is immediate.
      if (
        (settled && this.classIds.get(carIdx) !== classId) ||
        ((!settled || !isPlaced(settled.overall)) &&
          rankKeys(rank, classId).some((key) => {
            const occupant = this.occupants.get(key);

            return occupant !== undefined && occupant !== carIdx;
          }))
      ) {
        this.clearRanks();

        for (const [index, entry] of next) {
          this.setRank(index, entry.rank, entry.classId);
        }

        return;
      }
    }

    for (const [carIdx, { rank, classId }] of next) {
      const settled = this.settled.get(carIdx);

      if (settled && sameRank(settled, rank)) {
        this.pending.delete(carIdx);
        continue;
      }

      if (!settled || !isPlaced(settled.overall)) {
        if (settled) {
          this.releaseRanks(carIdx, settled);
        }

        this.setRank(carIdx, rank, classId);
        this.pending.delete(carIdx);
        continue;
      }

      const pending = this.pending.get(carIdx);

      if (!pending || !sameRank(pending.rank, rank)) {
        this.pending.set(carIdx, { rank, since: now });
      }
    }
  }

  private settlePending(now: number) {
    const ready = new Map<number, Rank>();

    for (const [carIdx, pending] of this.pending) {
      if (now - pending.since >= ORDER_SETTLE_MS) {
        ready.set(carIdx, pending.rank);
      }
    }

    // Keep only moves whose destinations are vacated in this batch. Removing
    // one move can block another, so repeat until all remaining moves can land.
    let removed = true;

    while (removed) {
      removed = false;

      for (const [carIdx, rank] of ready) {
        const classId = this.classIds.get(carIdx);

        if (
          classId === undefined ||
          rankKeys(rank, classId).some((key) => {
            const occupant = this.occupants.get(key);

            return (
              occupant !== undefined &&
              occupant !== carIdx &&
              !ready.has(occupant)
            );
          })
        ) {
          ready.delete(carIdx);
          removed = true;
        }
      }
    }

    for (const carIdx of ready.keys()) {
      const rank = this.settled.get(carIdx);

      if (rank) {
        this.releaseRanks(carIdx, rank);
      }
    }

    for (const [carIdx, rank] of ready) {
      const classId = this.classIds.get(carIdx);

      if (classId !== undefined) {
        this.setRank(carIdx, rank, classId);
        this.pending.delete(carIdx);
        this.clearArrowAfterMove(carIdx);
      }
    }
  }

  private setRank(carIdx: number, rank: Rank, classId: number) {
    this.settled.set(carIdx, rank);
    this.classIds.set(carIdx, classId);

    for (const key of rankKeys(rank, classId)) {
      this.occupants.set(key, carIdx);
    }
  }

  private releaseRanks(carIdx: number, rank: Rank) {
    const classId = this.classIds.get(carIdx);

    if (classId === undefined) {
      return;
    }

    for (const key of rankKeys(rank, classId)) {
      if (this.occupants.get(key) === carIdx) {
        this.occupants.delete(key);
      }
    }
  }

  private trackPositionChanges(entries: CarIdentity[], useTrackOrder: boolean) {
    for (const entry of entries) {
      const previous = this.previousPositions.get(entry.carIdx);
      const current = useTrackOrder ? entry.livePosition : entry.position;

      this.previousPositions.set(entry.carIdx, current);

      if (
        previous === undefined ||
        previous === current ||
        !isPlaced(previous) ||
        !isPlaced(current)
      ) {
        continue;
      }

      this.flashPositionChange(
        entry.carIdx,
        current < previous ? 'up' : 'down'
      );
    }
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
}
