/**
 * Environment telemetry store — weather and track conditions (60Hz).
 *
 * Contains ambient temperature. Extensible for future weather data
 * (track temperature, wind speed/direction, humidity, etc.)
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/airtemp/
 */
import { makeAutoObservable } from 'mobx';

import type { EnvironmentFrame } from '../../types/bindings';

class EnvironmentStore {
  /** Current environment frame, null when not connected */
  frame: EnvironmentFrame | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  updateFrame(frame: EnvironmentFrame) {
    this.frame = frame;
  }

  reset() {
    this.frame = null;
  }
}

export const environmentStore = new EnvironmentStore();
