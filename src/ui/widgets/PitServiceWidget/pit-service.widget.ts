import { makeAutoObservable, reaction, type IReactionDisposer } from 'mobx';

import type { RootStore } from '@store/root-store';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import { PitAutoService } from '@ui/widgets/PitServiceWidget/pit-auto-service';
import { PitOrder } from '@ui/widgets/PitServiceWidget/pit-order';
import { PitPanelState } from '@ui/widgets/PitServiceWidget/pit-panel';
import { distanceToPitEntryM } from '@ui/widgets/PitServiceWidget/pit-approach';

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
   * The car is close enough to the pit entry that the box is worth showing.
   *
   * Distance is the only honest signal — the sim reports nothing about
   * intention — so it is deliberately a short window: the order still has to be
   * changeable before the entry, but a lap of the box hanging over the track
   * because the pit entry happens to be round the next corner is worse than not
   * showing it at all. Zero switches it off.
   */
  get isApproachingPit(): boolean {
    const revealM = this.settings.revealOnApproachM;

    if (revealM <= 0) {
      return false;
    }

    const distM = this.distToPitEntryM;

    return distM !== null && distM <= revealM;
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
