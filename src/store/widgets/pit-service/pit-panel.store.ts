import { makeAutoObservable, runInAction } from 'mobx';

import type { PitServiceWidgetStore } from './pit-service.store';

// The panel lingers briefly after pit exit so the last service result stays
// readable while the car is already accelerating away.
const HIDE_DELAY_MS = 3000;

// The stop clock ticks on its own between frames: the pit tier runs at 4 Hz,
// which is too coarse to read as a running timer.
const STOP_TICK_MS = 100;
const MS_IN_SECOND = 1000;

// How far the local clock may drift from the telemetry thread's before it is
// pulled back. Re-anchoring on every frame would make the readout step
// backwards by a few hundredths whenever the two clocks disagree.
const CLOCK_RESYNC_S = 0.5;

/**
 * When the panel is on screen and how long the stop has been running.
 *
 * Split out of the widget store because everything here is timers and their
 * state — nothing in it decides or sends anything. The two `handle*Change`
 * methods are the only entry points the store's reactions drive.
 */
export class PitPanelState {
  /** Manual override toggled by hotkey; independent of pit road state. */
  manualShow = false;

  /**
   * Seconds the crew has worked on the current stop, run locally between the
   * telemetry thread's frames. It keeps the last stop's figure once service ends.
   */
  stopElapsedS = 0;

  /**
   * The panel is showing itself because a command just went out. Public so the
   * overlay can be told to reveal by the window the key was pressed in — the
   * runner lives in main, and the widget renders in the overlay.
   */
  commandRevealing = false;

  /**
   * The panel is holding itself up for a few seconds after pit exit. Public
   * because the lane bars ride the same tail — the GO they turn into is the end
   * of the very stop the box is still showing the result of.
   */
  lingering = false;

  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private lastOnPitRoad = false;
  /** Where the local stop clock was last set from a frame: seconds, and when. */
  private clockAnchor: { elapsedS: number; at: number } | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly store: PitServiceWidgetStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * How long the previous stop took this session. The sim reports no service
   * duration at all, so the only honest source for "how long will this take"
   * is what the last stop actually took — timed on the telemetry thread, so a
   * reloaded window still knows it.
   */
  get lastStopDurationS(): number | null {
    return this.store.root.backendComputed.pitStops?.lastServiceS ?? null;
  }

  /** Towing is shown anywhere on track — the sim has no other countdown for it. */
  get isVisible(): boolean {
    return (
      this.manualShow ||
      this.store.isApproachingPit ||
      this.store.isOnPitRoad ||
      this.store.isTowing ||
      this.lingering ||
      this.commandRevealing
    );
  }

  /**
   * Seconds the car is still expected to stand still: the countdowns the sim
   * reports plus whatever is left of a stop as long as the last one. Null when
   * nothing is known — the first stop of a session has nothing to learn from.
   */
  get expectedRemainingS(): number | null {
    const service = this.store.root.player.pitService;

    const timed = (service?.repairLeftS ?? 0) + (service?.optRepairLeftS ?? 0);
    const tow = this.store.towTimeS;

    if (!this.store.isServiceActive) {
      return timed + tow > 0 ? timed + tow : null;
    }

    if (this.lastStopDurationS === null) {
      return timed > 0 ? timed : null;
    }

    const serviceLeft = Math.max(0, this.lastStopDurationS - this.stopElapsedS);

    return Math.max(timed, serviceLeft);
  }

  toggleManualShow() {
    this.manualShow = !this.manualShow;
  }

  /**
   * Shows the panel for a few seconds after a command, so a key pressed on
   * track can be read back without the box staying up for the rest of the lap.
   *
   * Every order goes through `PitOrder.send`, so that is where this is
   * triggered from — one place rather than a call at the end of a dozen
   * methods. The temporary-show key is deliberately not one of these: it is a
   * latch the driver closes themselves, and a timer would take the box away
   * mid-edit.
   */
  revealAfterCommand() {
    const seconds = this.store.settings.commandRevealSeconds;

    if (seconds <= 0) {
      return;
    }

    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
    }

    // Every press restarts the countdown, so a burst of keys keeps the panel up
    // rather than letting the first press decide when it goes away.
    this.commandRevealing = true;

    this.revealTimer = setTimeout(() => {
      runInAction(() => {
        this.commandRevealing = false;
        this.revealTimer = null;
      });
    }, seconds * MS_IN_SECOND);
  }

  /**
   * Follows the telemetry thread's stop clock (`serviceElapsedS`, null while
   * the crew is not working) and runs it locally between frames.
   */
  followServiceClock(serviceElapsedS: number | null) {
    if (serviceElapsedS === null) {
      this.clearStopTimer();
      this.clockAnchor = null;

      return;
    }

    const drift = Math.abs(this.localElapsedS() - serviceElapsedS);

    if (this.clockAnchor === null || drift > CLOCK_RESYNC_S) {
      this.clockAnchor = { elapsedS: serviceElapsedS, at: performance.now() };
      this.setStopElapsed(serviceElapsedS);
    }

    if (this.stopTimer === null) {
      this.stopTimer = setInterval(() => {
        this.setStopElapsed(this.localElapsedS());
      }, STOP_TICK_MS);
    }
  }

  private localElapsedS(): number {
    const anchor = this.clockAnchor;

    if (anchor === null) {
      return 0;
    }

    return anchor.elapsedS + (performance.now() - anchor.at) / MS_IN_SECOND;
  }

  /**
   * Called on every pit road transition so the panel can linger after exit.
   * Kept as an explicit call rather than a reaction — the timer is UI state.
   */
  handlePitRoadChange(onPitRoad: boolean) {
    if (onPitRoad === this.lastOnPitRoad) {
      return;
    }

    this.lastOnPitRoad = onPitRoad;

    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (onPitRoad) {
      this.lingering = false;

      return;
    }

    this.lingering = true;

    this.hideTimer = setTimeout(() => {
      runInAction(() => {
        this.lingering = false;
        this.hideTimer = null;
      });
    }, HIDE_DELAY_MS);
  }

  private setStopElapsed(seconds: number) {
    this.stopElapsedS = seconds;
  }

  private clearStopTimer() {
    if (this.stopTimer !== null) {
      clearInterval(this.stopTimer);
      this.stopTimer = null;
    }
  }

  reset() {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.clearStopTimer();

    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }

    this.commandRevealing = false;
    this.manualShow = false;
    this.lingering = false;
    this.lastOnPitRoad = false;
    this.clockAnchor = null;
    this.stopElapsedS = 0;
  }
}
