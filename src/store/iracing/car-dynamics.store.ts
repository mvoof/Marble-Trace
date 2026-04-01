/**
 * Car dynamics telemetry store — high-frequency vehicle motion data (60Hz).
 *
 * Contains speed, RPM, gear, steering, velocity vectors, acceleration,
 * orientation, and shift timing indicators.
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/speed/
 * @see https://sajax.github.io/irsdkdocs/telemetry/rpm/
 * @see https://sajax.github.io/irsdkdocs/telemetry/gear/
 */
import { makeAutoObservable } from 'mobx';

import type { CarDynamicsFrame } from '../../types/bindings';

class CarDynamicsStore {
  /** Current car dynamics frame, null when not connected */
  frame: CarDynamicsFrame | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  updateFrame(frame: CarDynamicsFrame) {
    this.frame = frame;
  }

  reset() {
    this.frame = null;
  }
}

export const carDynamicsStore = new CarDynamicsStore();
