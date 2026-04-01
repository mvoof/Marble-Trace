/**
 * Car input telemetry store — driver pedal input data (60Hz).
 *
 * Contains throttle, brake, and clutch pedal positions.
 * Note: iRacing provides clutch as engagement (1=engaged/released, 0=disengaged/pressed).
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/throttle/
 * @see https://sajax.github.io/irsdkdocs/telemetry/brake/
 * @see https://sajax.github.io/irsdkdocs/telemetry/clutch/
 */
import { makeAutoObservable } from 'mobx';

import type { CarInputsFrame } from '../../types/bindings';

class CarInputsStore {
  /** Current car inputs frame, null when not connected */
  frame: CarInputsFrame | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  updateFrame(frame: CarInputsFrame) {
    this.frame = frame;
  }

  reset() {
    this.frame = null;
  }
}

export const carInputsStore = new CarInputsStore();
