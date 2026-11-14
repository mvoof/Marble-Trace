import { makeAutoObservable } from 'mobx';

/** Long enough to look up from the main window and find the number. */
export const MONITOR_IDENTIFY_DURATION_MS = 1600;

/**
 * An overlay's answer to Identify: its monitor's number, drawn big for a
 * moment and then gone. Main sends the number; the window only shows it.
 */
export class MonitorIdentifyStore {
  /** The number while it shows; null once it expires. */
  number: number | null = null;

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeAutoObservable<MonitorIdentifyStore, 'timer'>(
      this,
      { timer: false },
      { autoBind: true }
    );
  }

  show(monitorNumber: number) {
    this.number = monitorNumber;

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => this.expire(), MONITOR_IDENTIFY_DURATION_MS);
  }

  private expire() {
    this.timer = null;
    this.number = null;
  }
}
