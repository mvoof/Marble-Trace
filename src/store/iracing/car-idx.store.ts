/**
 * Car index telemetry store — per-car array data for all cars in session (60Hz).
 *
 * Contains lap distance percentages, pit road status, positions,
 * and the player's CarLeftRight proximity indicator.
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/caridxlapdistpct/
 * @see https://sajax.github.io/irsdkdocs/telemetry/carleftright/
 */
import { makeAutoObservable } from 'mobx';

import type { CarIdxFrame } from '../../types/bindings';

class CarIdxStore {
  /** Current car index frame, null when not connected */
  frame: CarIdxFrame | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  updateFrame(frame: CarIdxFrame) {
    this.frame = frame;
  }

  reset() {
    this.frame = null;
  }
}

export const carIdxStore = new CarIdxStore();
