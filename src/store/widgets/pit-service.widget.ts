import { makeAutoObservable } from 'mobx';

import type { RootStore } from '@store/root-store';

// The panel lingers briefly after pit exit so the last service result stays
// readable while the car is already accelerating away.
const HIDE_DELAY_MS = 3000;

// The stop clock ticks on its own rather than on telemetry: the pit service
// tier runs at 4 Hz, which is too coarse to read as a running timer.
const STOP_TICK_MS = 100;
const MS_IN_SECOND = 1000;

export class PitServiceWidgetStore {
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

  private lingering = false;
  private lastOnPitRoad = false;
  private lastServiceActive = false;
  private stallEnteredAt: number | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isOnPitRoad(): boolean {
    return this.root.player.carStatus?.on_pit_road ?? false;
  }

  get isInPitStall(): boolean {
    return this.root.player.pitService?.inPitStall ?? false;
  }

  /** The crew is working on the car —  from the sim. */
  get isServiceActive(): boolean {
    return this.root.player.pitService?.serviceActive ?? false;
  }

  get towTimeS(): number {
    return this.root.player.pitService?.towTimeS ?? 0;
  }

  get isTowing(): boolean {
    return this.towTimeS > 0;
  }

  /** Towing is shown anywhere on track — the sim has no other countdown for it. */
  get isVisible(): boolean {
    return (
      this.manualShow || this.isOnPitRoad || this.isTowing || this.lingering
    );
  }

  /**
   * Seconds the car is still expected to stand still: the countdowns the sim
   * reports plus whatever is left of a stop as long as the last one. Null when
   * nothing is known — the first stop of a session has nothing to learn from.
   */
  get expectedRemainingS(): number | null {
    const service = this.root.player.pitService;

    const timed = (service?.repairLeftS ?? 0) + (service?.optRepairLeftS ?? 0);
    const tow = this.towTimeS;

    if (!this.isServiceActive) {
      return timed + tow > 0 ? timed + tow : null;
    }

    if (this.lastStopDurationS === null) {
      return timed > 0 ? timed : null;
    }

    const serviceLeft = Math.max(0, this.lastStopDurationS - this.stopElapsedS);

    return Math.max(timed, serviceLeft);
  }

  /**
   * Runs the stop clock off , not off standing in the box: the
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

  private setStopElapsed(seconds: number) {
    this.stopElapsedS = seconds;
  }

  private clearStopTimer() {
    if (this.stopTimer !== null) {
      clearInterval(this.stopTimer);
      this.stopTimer = null;
    }
  }

  toggleManualShow() {
    this.manualShow = !this.manualShow;
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
      this.lingering = false;
      this.hideTimer = null;
    }, HIDE_DELAY_MS);
  }

  reset() {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.clearStopTimer();

    this.manualShow = false;
    this.lingering = false;
    this.lastOnPitRoad = false;
    this.lastServiceActive = false;
    this.stallEnteredAt = null;
    this.stopElapsedS = 0;
    this.lastStopDurationS = null;
  }
}
