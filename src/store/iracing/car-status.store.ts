/**
 * Car status telemetry store — vehicle systems and state data (60Hz).
 *
 * Contains fuel levels, engine temperatures, oil pressure, voltage,
 * pit road status, on-track status, and proximity indicators.
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/fuellevel/
 * @see https://sajax.github.io/irsdkdocs/telemetry/oiltemp/
 * @see https://sajax.github.io/irsdkdocs/telemetry/onpitroad/
 */
import { makeAutoObservable } from 'mobx';

import type { CarStatusFrame } from '../../types/bindings';

class CarStatusStore {
  /** Current car status frame, null when not connected */
  frame: CarStatusFrame | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  updateFrame(frame: CarStatusFrame) {
    this.frame = frame;
  }

  reset() {
    this.frame = null;
  }
}

export const carStatusStore = new CarStatusStore();
