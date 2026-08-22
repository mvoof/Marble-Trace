import {
  action,
  makeAutoObservable,
  reaction,
  type IReactionDisposer,
} from 'mobx';

import { isHiddenInQualifying } from '@utils/qualifying-visibility';
import type { DuelBarWidgetSettings } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import {
  buildOpponents,
  buildPlateGroups,
  isWithinThreshold,
  matchesSides,
  mergedCarIdxs,
  resolveAxisRange,
  type DuelOpponent,
  type DuelPlateGroup,
} from './duel-bar-utils';

const WIDGET_ID = 'duel-bar';

const setsMatch = (first: Set<number>, second: Set<number>): boolean =>
  first.size === second.size && [...first].every((idx) => second.has(idx));

/** A row leaves at 1.3 × the threshold, or it blinks on every straight. */
const LEAVE_HYSTERESIS = 1.3;

export class DuelBarWidgetStore {
  visible = false;

  /**
   * The automatic axis range currently in force. Held in the store rather than
   * recomputed from scratch every tick so the axis does not flip between two
   * steps while a car sits on the boundary.
   */
  heldAxisRange = 50;

  /**
   * The cars drawn inside somebody else's plate on the previous tick. Feeding
   * them back in is what gives the merge its hysteresis — without it two cars
   * trading a metre would split and re-merge several times a second.
   */
  heldMerged: ReadonlySet<number> = new Set();

  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimerDelay = 0;

  private disposers: IReactionDisposer[] = [];

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this);
  }

  init() {
    this.disposers.push(
      reaction(
        () => mergedCarIdxs(this.plateGroups),
        action((merged: Set<number>) => {
          this.heldMerged = merged;
        }),
        { equals: setsMatch }
      )
    );

    // The resolved range is written back so the next tick compares against the
    // range actually in force — without it the hysteresis has nothing to hold.
    this.disposers.push(
      reaction(
        () => this.axisRange,
        action((range: number) => {
          this.heldAxisRange = range;
        }),
        { fireImmediately: true }
      )
    );

    this.disposers.push(
      reaction(
        () => ({
          hasOpponents: this.opponents.length > 0,
          delay: this.hideDelay,
        }),
        ({ hasOpponents, delay }) => {
          if (hasOpponents) {
            this.clearHideTimer();

            action(() => {
              this.visible = true;
            })();

            return;
          }

          if (this.hideTimer) {
            if (this.hideTimerDelay === delay) {
              return;
            }

            this.clearHideTimer();
          }

          this.hideTimerDelay = delay;
          this.hideTimer = setTimeout(
            action(() => {
              this.visible = false;
              this.hideTimer = null;
            }),
            delay * 1000
          );
        }
      )
    );
  }

  dispose() {
    this.clearHideTimer();

    for (const disposeReaction of this.disposers) {
      disposeReaction();
    }

    this.disposers = [];
  }

  /** The plates as drawn: one per spot on the axis, merged cars folded in. */
  get plateGroups(): DuelPlateGroup[] {
    return buildPlateGroups(
      this.opponents,
      this.axisRange,
      this.settings.mergeOverlapping,
      this.settings.mergeDistance,
      this.heldMerged
    );
  }

  /** What the top and bottom edge of the widget mean right now, in meters. */
  get axisRange(): number {
    return resolveAxisRange(
      this.settings.axisRange,
      this.farthestClearance,
      this.heldAxisRange
    );
  }

  private get farthestClearance(): number {
    return this.opponents.reduce(
      (farthest, opponent) => Math.max(farthest, opponent.clearance),
      0
    );
  }

  /**
   * Drag mode always draws the widget, or it could not be placed. Someone in
   * the threshold draws it too, without waiting for the reaction: a preview
   * store runs with `skipInit`, so `visible` would never be raised there and
   * the widget-settings preview would stay blank with data right in front of it.
   * The flag then only holds the widget on screen for the fade-out delay.
   */
  get isVisible(): boolean {
    return (
      this.root.appSettings.dragMode ||
      this.visible ||
      this.opponents.length > 0
    );
  }

  get settings(): DuelBarWidgetSettings {
    return this.root.widgetSettings.getSettings<DuelBarWidgetSettings>(
      WIDGET_ID
    );
  }

  /**
   * Everyone inside the threshold, nearest first. The hysteresis is applied to
   * the whole list rather than per row: a car that is already drawn stays until
   * it passes 1.3 × the threshold, and the hide timer does the rest.
   */
  get opponents(): DuelOpponent[] {
    const proximity = this.root.backendComputed.proximity;

    if (!proximity) {
      return [];
    }

    const settings = this.settings;

    if (settings.raceOnly && this.root.session.currentSessionType !== 'Race') {
      return [];
    }

    if (
      isHiddenInQualifying(settings.qualifyingVisibility, this.root.session)
    ) {
      return [];
    }

    // Pit road is not a fight: the cars around you there are queueing, and the
    // gaps to them say nothing about racing them.
    if (settings.hideInPits && this.isOnPitRoad) {
      return [];
    }

    const hysteresis = this.visible ? LEAVE_HYSTERESIS : 1;

    return buildOpponents(
      proximity.nearbyCars,
      this.root.backendComputed.relativeEntries,
      this.paceCarIdxs
    )
      .filter((opponent) => matchesSides(opponent, settings.sides))
      .filter(
        (opponent) => !(settings.otherClass === 'hide' && opponent.isOtherClass)
      )
      .filter((opponent) => isWithinThreshold(opponent, settings, hysteresis))
      .sort((first, second) => first.clearance - second.clearance)
      .slice(0, settings.maxRows);
  }

  /** The nearest car behind, and the nearest ahead — the glow reads only these. */
  get nearestBehind(): DuelOpponent | null {
    return this.opponents.find((opponent) => !opponent.isAhead) ?? null;
  }

  get nearestAhead(): DuelOpponent | null {
    return this.opponents.find((opponent) => opponent.isAhead) ?? null;
  }

  private get paceCarIdxs(): ReadonlySet<number> {
    const cars = this.root.session.sessionInfo?.cars ?? [];

    return new Set(
      cars.filter((car) => car.isPaceCar).map((car) => car.carIdx)
    );
  }

  private get isOnPitRoad(): boolean {
    return this.root.player.carStatus?.on_pit_road ?? false;
  }

  private get hideDelay(): number {
    return this.settings.hideDelay;
  }

  private clearHideTimer() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
