import { makeAutoObservable, reaction, type IReactionDisposer } from 'mobx';

import type { PitServiceWidgetSettings } from '@entities/widget/widget-settings';
import type { PitStrategy } from '@shared/contracts/pit-strategy';
import { PitAutoService } from './pit-auto-service.store';
import { PitOrder } from './pit-order.store';
import { PitPanelState } from './pit-panel.store';
import { distanceToPitEntryM } from '@features/pit-service/pit-approach';
import { PIT_LIMITER_BIT } from '@shared/lib/car-signals';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { PlayerStore } from '@entities/player/player.store';
import type { TrackMapWidgetStore } from '@entities/track/track-map.store';
import type { SessionStore } from '@entities/session/session.store';
import type { BackendComputedStore } from '@entities/cars/computed.store';
import type { AppSettingsStore } from '@entities/app-settings/app-settings.store';
import type { UnitsStore } from '@entities/app-settings/units.store';

interface PitServiceDeps {
  liveWidgets: LiveWidgetsView;
  player: PlayerStore;
  trackMapWidget: TrackMapWidgetStore;
  session: SessionStore;
  backendComputed: BackendComputedStore;
  appSettings: AppSettingsStore;
  units: UnitsStore;
}

/**
 * The widget's entry point, and the three things it is made of:
 *
 * - `order` — what the sim has checked and every manual change to it,
 * - `auto` — what auto mode, deciding on the telemetry thread, reports back,
 * - `panel` — when the box is on screen and how long the stop has run.
 *
 * They are separate objects rather than one class because they share almost no
 * state: the only crossings are a manual change claiming its half from auto
 * mode, and every send asking the panel to reveal itself. Each reaches its
 * siblings through this store, so the wiring is visible in one place.
 *
 * What stays here is what all three need: the root store, the widget's
 * settings, the raw pit telemetry, and the lifecycle.
 *
 * App-wide, not per instance: the main window sends the order from hotkeys
 * with no widget mounted there, the pit-line widget and the auto-hide ride the
 * same panel, and the race dash measures against the same lane.
 */
export class PitServiceWidgetStore {
  readonly panel: PitPanelState;
  readonly auto: PitAutoService;
  readonly order: PitOrder;

  private readonly disposers: IReactionDisposer[] = [];

  constructor(readonly root: PitServiceDeps) {
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
   * Watches the telemetry transitions this widget owns timers for.
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
        (serviceActive) => {
          this.order.handleServiceActiveChange(serviceActive);
        },
        { fireImmediately: true }
      ),
      // The stop clock is the telemetry thread's; the panel only runs it
      // between frames.
      reaction(
        () => this.root.backendComputed.pitStops?.serviceElapsedS ?? null,
        (serviceElapsedS) => this.panel.followServiceClock(serviceElapsedS),
        { fireImmediately: true }
      ),
      // An order auto mode sent is confirmed the way a key press is. Only a
      // step counts: the first frame a window receives carries the count so
      // far, which is history rather than an order going out now.
      reaction(
        () => this.root.backendComputed.pitAuto,
        (frame, previous) => {
          if (
            frame === null ||
            previous === null ||
            frame.ordersSent <= previous.ordersSent
          ) {
            return;
          }

          this.panel.revealAfterCommand();
          this.order.reportOrderResult(
            frame.lastOrderOk === false ? 'failed' : 'sent'
          );
        }
      )
    );
  }

  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
  }

  /**
   * The rules the order is built by. App-level, not a widget setting: the order
   * goes to the one car in the sim, so two pit boxes holding different
   * auto-fuel rules would send two orders for one stop.
   */
  get strategy(): PitStrategy {
    return this.root.appSettings.appSettings;
  }

  /**
   * The display settings of the instance that speaks for the widget — the
   * reveal distance the panel opens at, which this one app-wide store has to
   * pick a single answer for.
   */
  get settings(): PitServiceWidgetSettings {
    return this.root.liveWidgets.settingsOfType<PitServiceWidgetSettings>(
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
    return this.isApproachingWithin(this.settings.revealOnApproachM);
  }

  /**
   * The same question asked with someone else's distance. The lane bars keep
   * their own reveal — they are read on the way into the lane, the order a lap
   * earlier — so the window is a parameter rather than a second copy of the
   * geometry above.
   */
  isApproachingWithin = (revealM: number): boolean => {
    if (revealM <= 0) {
      return false;
    }

    const distM = this.distToPitEntryM;

    return distM !== null && distM <= revealM;
  };

  /**
   * The pit lane's length in meters, or null on a track whose lane has not been
   * recorded yet. Owned here rather than derived per widget: the rail and the
   * race dash both draw against it, and two answers would be one too many.
   */
  get pitLaneLengthM(): number | null {
    const pitInPct = this.root.trackMapWidget.trackShape?.pitInPct ?? null;
    const pitExitPct = this.root.trackMapWidget.trackShape?.pitExitPct ?? null;
    const trackLengthM = this.root.session.sessionInfo?.trackLengthM ?? 0;

    if (pitInPct === null || pitExitPct === null || trackLengthM <= 0) {
      return null;
    }

    return ((pitExitPct - pitInPct + 1) % 1) * trackLengthM;
  }

  /** Where the player's stall sits along the lane, 0..1, or null off a recorded lane. */
  get pitboxLanePct(): number | null {
    const pitInPct = this.root.trackMapWidget.trackShape?.pitInPct ?? null;
    const pitExitPct = this.root.trackMapWidget.trackShape?.pitExitPct ?? null;
    const pitboxPct = this.root.session.sessionInfo?.driverPitTrkPct ?? null;

    if (pitInPct === null || pitExitPct === null || pitboxPct === null) {
      return null;
    }

    const laneLengthPct = (pitExitPct - pitInPct + 1) % 1;

    if (laneLengthPct <= 0) {
      return null;
    }

    return Math.min(
      Math.max(((pitboxPct - pitInPct + 1) % 1) / laneLengthPct, 0),
      1
    );
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

  reset() {
    this.panel.reset();
    this.order.reset();
  }
}
