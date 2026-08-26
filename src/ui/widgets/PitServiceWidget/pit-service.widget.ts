import { makeAutoObservable, reaction, type IReactionDisposer } from 'mobx';

import type { RootStore } from '@store/root-store';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import { PitAutoService } from '@ui/widgets/PitServiceWidget/pit-auto-service';
import { PitOrder } from '@ui/widgets/PitServiceWidget/pit-order';
import { PitPanelState } from '@ui/widgets/PitServiceWidget/pit-panel';
import { distanceToPitEntryM } from '@ui/widgets/PitServiceWidget/pit-approach';
import { resolveServiceState } from '@ui/widgets/PitServiceWidget/pit-service-utils';
import { PIT_LIMITER_BIT } from '@ui/hooks/usePitState';

/**
 * The widget's entry point, and the three things it is made of:
 *
 * - `order` — what the sim has checked and every manual change to it,
 * - `auto` — what the widget decides on the driver's behalf,
 * - `panel` — when the box is on screen and how long the stop has run.
 *
 * They are separate objects rather than one class because they share almost no
 * state: the only crossings are a manual change claiming its half from auto
 * mode, and every send asking the panel to reveal itself. Each reaches its
 * siblings through this store, so the wiring is visible in one place.
 *
 * What stays here is what all three need: the root store, the widget's
 * settings, the raw pit telemetry, and the lifecycle.
 */
export class PitServiceWidgetStore {
  readonly panel: PitPanelState;
  readonly auto: PitAutoService;
  readonly order: PitOrder;

  private readonly disposers: IReactionDisposer[] = [];

  constructor(readonly root: RootStore) {
    this.panel = new PitPanelState(this);
    this.auto = new PitAutoService(this);
    this.order = new PitOrder(this);

    makeAutoObservable(
      this,
      { root: false, panel: false, auto: false, order: false },
      { autoBind: true }
    );
  }

  /**
   * Watches the two telemetry transitions this widget owns timers for.
   *
   * Both handlers are edge-guarded, and `fireImmediately` reproduces what the
   * bundle handler used to do: a window opened while the car is already on pit
   * road still starts the stop clock. Reading them here rather than being
   * pushed from the telemetry dispatcher keeps the dependency pointing the way
   * the layer rules require — widget store → data store.
   */
  init() {
    this.disposers.push(
      reaction(
        () => this.isOnPitRoad,
        (onPitRoad) => this.panel.handlePitRoadChange(onPitRoad),
        { fireImmediately: true }
      ),
      reaction(
        () => this.isServiceActive,
        (serviceActive) => this.panel.handleServiceActiveChange(serviceActive),
        { fireImmediately: true }
      )
    );
  }

  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
  }

  get settings(): PitServiceWidgetSettings {
    return this.root.widgetSettings.getSettings<PitServiceWidgetSettings>(
      'pit-service'
    );
  }

  get isOnPitRoad(): boolean {
    return this.root.player.carStatus?.on_pit_road ?? false;
  }

  /**
   * Meters to the pit entry line, or null off a recorded lane. Counts the whole
   * lap ahead, so it is only a statement about approaching the pits together
   * with the reveal distance below.
   */
  get distToPitEntryM(): number | null {
    if (this.isOnPitRoad) {
      return null;
    }

    return distanceToPitEntryM(
      this.root.player.lapTiming?.lap_dist_pct,
      this.root.trackMapWidget.trackShape?.pitInPct,
      this.root.session.sessionInfo?.trackLengthM
    );
  }

  /**
   * The two things a driver about to pit does that the sim actually reports:
   * they set the service up, and they arm the limiter. Neither is a promise —
   * an order can sit armed for a whole stint — but together they are the only
   * statement of intent iRacing makes, and without one of them a car passing
   * the pit entry at racing speed is simply passing it.
   */
  private get hasPitIntent(): boolean {
    if (this.isLimiterOn) {
      return true;
    }

    return (
      resolveServiceState(this.root.player.pitService, this.isInPitStall) ===
      'armed'
    );
  }

  /**
   * The car is close enough to the pit entry that the box is worth showing —
   * and is heading in rather than driving past.
   *
   * The distance alone is not enough: on a lot of tracks the entry sits on the
   * racing line, so a plain radius pops the panel up every single lap. The
   * sim reports nothing about intention, so the gate is the pair above. The
   * window stays short on top of that — the order has to be changeable before
   * the entry, and a box hanging over the track for half a lap is worse than
   * not showing it at all. Zero switches the reveal off.
   */
  get isApproachingPit(): boolean {
    const revealM = this.settings.revealOnApproachM;

    if (revealM <= 0 || !this.hasPitIntent) {
      return false;
    }

    const distM = this.distToPitEntryM;

    return distM !== null && distM <= revealM;
  }

  /** The sim's pit limiter flag, straight off the engine warning bitmask. */
  get isLimiterOn(): boolean {
    return (
      ((this.root.player.carStatus?.engine_warnings ?? 0) & PIT_LIMITER_BIT) !==
      0
    );
  }

  /**
   * The car is out of the pits and the lane's limit no longer binds it — the
   * moment the speed row stops policing a number and turns into the go-ahead.
   *
   * Being off pit road is not enough on its own: the widget shows itself on the
   * approach as well (`revealOnApproachM`), and a green GO in front of a driver
   * braking for the entry is the opposite of the truth. On the way in the limit
   * still applies in a few hundred meters, so the row stays a scale.
   */
  get isPitLimitReleased(): boolean {
    return !this.isOnPitRoad && !this.isLimiterOn && !this.isApproachingPit;
  }

  get isInPitStall(): boolean {
    return this.root.player.pitService?.inPitStall ?? false;
  }

  /** The crew is working on the car — `pitstop_active` from the sim. */
  get isServiceActive(): boolean {
    return this.root.player.pitService?.serviceActive ?? false;
  }

  get towTimeS(): number {
    return this.root.player.pitService?.towTimeS ?? 0;
  }

  get isTowing(): boolean {
    return this.towTimeS > 0;
  }

  /** Entry point for the sync layer: the key was pressed in the other window. */
  revealFromCommand() {
    this.panel.revealAfterCommand();
  }

  reset() {
    this.panel.reset();
    this.auto.reset();
    this.order.reset();
  }
}
