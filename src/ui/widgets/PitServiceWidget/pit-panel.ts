import { makeAutoObservable, runInAction } from 'mobx';

import type { PitServiceWidgetStore } from '@ui/widgets/PitServiceWidget/pit-service.widget';

// The panel lingers briefly after pit exit so the last service result stays
// readable while the car is already accelerating away.
const HIDE_DELAY_MS = 3000;

// The stop clock ticks on its own rather than on telemetry: the pit service
// tier runs at 4 Hz, which is too coarse to read as a running timer.
const STOP_TICK_MS = 100;
const MS_IN_SECOND = 1000;

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

  /** Seconds spent in the pit stall on the current stop. */
  stopElapsedS = 0;

  /**
   * How long the previous stop took this session. The sim reports no service
   * duration at all, so the only honest source for "how long will this take"
   * is what the last stop actually took.
   */
  lastStopDurationS: number | null = null;

  /**
   * The panel is showing itself because a command just went out. Public so the
   * overlay can be told to reveal by the window the key was pressed in — the
   * runner lives in main, and the widget renders in the overlay.
   */
  commandRevealing = false;

  /**
   * Bumped once per command. The sync layer watches this rather than
   * `commandRevealing`: a boolean only changes on the first press of a burst,
   * so the second key inside an open window would never reach the overlay, and
   * the overlay would hide on the deadline of the first press while main still
   * held the flag — after which no rising edge was left to show it again.
   */
  commandRevealNonce = 0;

  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private lingering = false;
  private lastOnPitRoad = false;
  private lastServiceActive = false;
  private stallEnteredAt: number | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly store: PitServiceWidgetStore) {
    makeAutoObservable(this, {}, { autoBind: true });
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
    this.commandRevealNonce++;

    this.revealTimer = setTimeout(() => {
      runInAction(() => {
        this.commandRevealing = false;
        this.revealTimer = null;
      });
    }, seconds * MS_IN_SECOND);
  }

  /**
   * Runs the stop clock off `serviceActive`, not off standing in the box: the
   * sim reports no service duration, and the crew starts and finishes on its
   * own schedule — the car sits in the stall both before and after that.
   */
  handleServiceActiveChange(serviceActive: boolean) {
    if (serviceActive === this.lastServiceActive) {
      return;
    }

    this.lastServiceActive = serviceActive;

    if (serviceActive) {
      this.stallEnteredAt = performance.now();
      this.stopElapsedS = 0;

      this.stopTimer = setInterval(() => {
        if (this.stallEnteredAt === null) return;

        this.setStopElapsed(
          (performance.now() - this.stallEnteredAt) / MS_IN_SECOND
        );
      }, STOP_TICK_MS);

      return;
    }

    this.clearStopTimer();

    if (this.stopElapsedS > 0) {
      this.lastStopDurationS = this.stopElapsedS;
    }

    this.stallEnteredAt = null;
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
      this.store.auto.armSelfArmedClear();

      return;
    }

    this.lingering = true;
    this.store.auto.clearStopOverrides();

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
    this.lastServiceActive = false;
    this.stallEnteredAt = null;
    this.stopElapsedS = 0;
    this.lastStopDurationS = null;
  }
}
