/**
 * Lap timing telemetry store — lap times, distances, and positions (60Hz).
 *
 * Contains current/last/best lap times, distance around track,
 * and overall/class position standings.
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/lapcurrentlaptime/
 * @see https://sajax.github.io/irsdkdocs/telemetry/lapdistpct/
 * @see https://sajax.github.io/irsdkdocs/telemetry/playercarposition/
 */
import { makeAutoObservable } from 'mobx';

import type { LapTimingFrame } from '../../types/bindings';

class LapTimingStore {
  /** Current lap timing frame, null when not connected */
  frame: LapTimingFrame | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  updateFrame(frame: LapTimingFrame) {
    this.frame = frame;
  }

  reset() {
    this.frame = null;
  }
}

export const lapTimingStore = new LapTimingStore();
