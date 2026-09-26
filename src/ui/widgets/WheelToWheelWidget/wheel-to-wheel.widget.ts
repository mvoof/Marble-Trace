import {
  action,
  comparer,
  computed,
  makeAutoObservable,
  makeObservable,
  reaction,
  type IReactionDisposer,
} from 'mobx';

import type { UnitSystem } from '@/types';
import type { DriverEntry } from '@/types/bindings';
import type { WheelToWheelWidgetSettings } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import { formatSpeed } from '@utils/telemetry-format';
import { computeRelativeGap } from '@ui/widgets/RelativeWidget/relative-utils';
import {
  formatBattleGap,
  litSpeedSegments,
  pickRivals,
  type WheelToWheelRivals,
} from './wheel-to-wheel-utils';

type WheelToWheelDeps = Pick<
  RootStore,
  'units' | 'appSettings' | 'liveWidgets' | 'backendComputed' | 'session'
>;

const WIDGET_ID = 'wheel-to-wheel';

/** A place on the plate: you, and a rival on either side of you. */
export type BattleSlot = 'player' | 'ahead' | 'behind';

export type RivalSlot = Exclude<BattleSlot, 'player'>;

/** What a slot draws that only changes when the fight does, not every tick. */
export interface SideIdentity {
  position: number;
  carNumber: string;
  name: string;
  carName: string;
}

const NO_RIVALS: WheelToWheelRivals = { ahead: null, behind: null };

const identityOf = (entry: DriverEntry | null): SideIdentity | null => {
  if (!entry) {
    return null;
  }

  return {
    position: entry.liveClassPosition || entry.classPosition,
    carNumber: entry.carNumber,
    name: entry.userName,
    carName: entry.carScreenNameShort || entry.carScreenName,
  };
};

/**
 * One slot's readouts, each its own computed. A component reading one of them
 * re-renders only when that value changes — the relative frame itself changes
 * ten times a second, and a name read straight from it would redraw the whole
 * side on every one of them.
 */
export class BattleSlotView {
  constructor(
    private readonly own: () => DriverEntry | null,
    private readonly other: () => DriverEntry | null,
    private readonly player: () => DriverEntry | null,
    private readonly unitSystem: () => UnitSystem
  ) {
    makeObservable(this, {
      identity: computed.struct,
      speedText: computed,
      litSegments: computed,
      gapText: computed,
    });
  }

  get identity(): SideIdentity | null {
    return identityOf(this.own());
  }

  get speedText(): string {
    return formatSpeed(this.own()?.speed ?? 0, this.unitSystem());
  }

  /** The bar compares this car with the one it is fighting. */
  get litSegments(): number | null {
    return litSpeedSegments(this.own()?.speed ?? 0, this.other()?.speed ?? 0);
  }

  /** From the player's side: `+` is you in front. */
  get gapText(): string {
    const own = this.own();
    const player = this.player();

    if (!own || !player) {
      return formatBattleGap(0);
    }

    return formatBattleGap(computeRelativeGap(own, player));
  }
}

export class WheelToWheelWidgetStore {
  visible = false;

  /**
   * The cars on the plate. Kept after they leave the threshold, so the fade-out
   * delay shows the rivals who just got away rather than an empty half.
   */
  heldAheadIdx: number | null = null;
  heldBehindIdx: number | null = null;

  readonly slots: Record<BattleSlot, BattleSlotView>;

  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  private disposers: IReactionDisposer[] = [];

  constructor(private readonly root: WheelToWheelDeps) {
    makeAutoObservable<WheelToWheelWidgetStore, 'root'>(this, {
      root: false,
      slots: false,
    });

    const unitSystem = () => this.root.units.unitSystem;
    const player = () => this.playerEntry;

    this.slots = {
      player: new BattleSlotView(
        player,
        () => this.primaryRivalEntry,
        player,
        unitSystem
      ),
      ahead: new BattleSlotView(
        () => this.shownAheadEntry,
        player,
        player,
        unitSystem
      ),
      behind: new BattleSlotView(
        () => this.shownBehindEntry,
        player,
        player,
        unitSystem
      ),
    };
  }

  init() {
    this.disposers.push(
      reaction(
        () => [
          this.rivals.ahead?.entry.carIdx ?? null,
          this.rivals.behind?.entry.carIdx ?? null,
        ],
        ([aheadIdx, behindIdx]) => {
          if (aheadIdx !== null || behindIdx !== null) {
            this.clearHideTimer();

            // A side that lost its rival while the other still has one simply
            // empties; only the last rival to leave is held for the fade-out.
            action(() => {
              this.heldAheadIdx = aheadIdx;
              this.heldBehindIdx = behindIdx;
              this.visible = true;
            })();

            return;
          }

          if (this.hideTimer) {
            return;
          }

          this.hideTimer = setTimeout(
            action(() => {
              this.visible = false;
              this.heldAheadIdx = null;
              this.heldBehindIdx = null;
              this.hideTimer = null;
            }),
            this.settings.hideDelay * 1000
          );
        },
        {
          equals: comparer.structural,
          // Rivals already alongside when the store starts must be held too,
          // or the first time they drop back the plate vanishes without its
          // delay.
          fireImmediately: true,
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

  get settings(): WheelToWheelWidgetSettings {
    return this.root.liveWidgets.getSettings<WheelToWheelWidgetSettings>(
      WIDGET_ID
    );
  }

  /**
   * Drag mode always draws the widget, or it could not be placed. A fight in
   * progress draws it too without waiting for the reaction: a preview store
   * runs with `skipInit`, so `visible` would never be raised there.
   */
  get isVisible(): boolean {
    if (!this.playerEntry) {
      return false;
    }

    return (
      this.root.appSettings.dragMode ||
      this.hasLiveRival ||
      (this.visible &&
        (this.shownAheadEntry !== null || this.shownBehindEntry !== null))
    );
  }

  /** A rival on both sides: the right half splits, ahead on top. */
  get isSplit(): boolean {
    return this.shownAheadEntry !== null && this.shownBehindEntry !== null;
  }

  /** The one rival's slot while the half is not split. */
  get singleSlot(): RivalSlot {
    return this.shownAheadEntry !== null ? 'ahead' : 'behind';
  }

  get playerEntry(): DriverEntry | null {
    return (
      this.root.backendComputed.relativeEntries.find(
        (entry) => entry.isPlayer
      ) ?? null
    );
  }

  /** The fight right now, both sides empty when nobody is inside the threshold. */
  get rivals(): WheelToWheelRivals {
    const player = this.playerEntry;

    if (!player || player.onPitRoad) {
      return NO_RIVALS;
    }

    const settings = this.settings;
    const isRace = this.root.session.currentSessionType === 'Race';

    if (settings.raceOnly && !isRace) {
      return NO_RIVALS;
    }

    return pickRivals(this.root.backendComputed.relativeEntries, player, {
      thresholdSeconds: settings.gapThreshold,
      heldAheadIdx: this.heldAheadIdx,
      heldBehindIdx: this.heldBehindIdx,
      excludedCarIdxs: this.paceCarIdxs,
      countsLaps: isRace && !settings.includeLapped,
    });
  }

  get shownAheadEntry(): DriverEntry | null {
    return this.shownEntry('ahead');
  }

  get shownBehindEntry(): DriverEntry | null {
    return this.shownEntry('behind');
  }

  private get hasLiveRival(): boolean {
    return this.rivals.ahead !== null || this.rivals.behind !== null;
  }

  /** The nearer of the two — the one your own speed bar is measured against. */
  private get primaryRivalEntry(): DriverEntry | null {
    const player = this.playerEntry;
    const ahead = this.shownAheadEntry;
    const behind = this.shownBehindEntry;

    if (!player || !ahead || !behind) {
      return ahead ?? behind;
    }

    const aheadGap = Math.abs(computeRelativeGap(ahead, player));
    const behindGap = Math.abs(computeRelativeGap(behind, player));

    return aheadGap <= behindGap ? ahead : behind;
  }

  /**
   * The car a rival slot draws: the live one, else the one held for the
   * fade-out, else — in drag mode with nobody near — the nearest car of the
   * class on its side, so the widget can be placed with real names on it.
   */
  private shownEntry(slot: RivalSlot): DriverEntry | null {
    const live = this.rivals[slot];

    if (live) {
      return live.entry;
    }

    const heldIdx = slot === 'ahead' ? this.heldAheadIdx : this.heldBehindIdx;
    const entries = this.root.backendComputed.relativeEntries;
    const held = entries.find((entry) => entry.carIdx === heldIdx);

    if (held) {
      return held;
    }

    if (!this.root.appSettings.dragMode || this.hasAnyHeld) {
      return null;
    }

    const stand = this.nearestClassRival;

    if (!stand) {
      return null;
    }

    const standSlot: RivalSlot = stand.relativeLapDist > 0 ? 'ahead' : 'behind';

    return standSlot === slot ? stand : null;
  }

  private get hasAnyHeld(): boolean {
    return this.heldAheadIdx !== null || this.heldBehindIdx !== null;
  }

  private get nearestClassRival(): DriverEntry | null {
    const player = this.playerEntry;

    if (!player || this.hasLiveRival) {
      return null;
    }

    return (
      this.root.backendComputed.relativeEntries
        .filter(
          (entry) =>
            !entry.isPlayer &&
            !this.paceCarIdxs.has(entry.carIdx) &&
            entry.carClassId === player.carClassId
        )
        .sort(
          (first, second) =>
            Math.abs(first.relativeLapDist) - Math.abs(second.relativeLapDist)
        )[0] ?? null
    );
  }

  private get paceCarIdxs(): ReadonlySet<number> {
    const cars = this.root.session.sessionInfo?.cars ?? [];

    return new Set(
      cars.filter((car) => car.isPaceCar).map((car) => car.carIdx)
    );
  }

  private clearHideTimer() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
