import { makeAutoObservable } from 'mobx';
import {
  formatSpeed as _formatSpeed,
  formatTemp as _formatTemp,
  formatFuel as _formatFuel,
  formatDistance as _formatDistance,
  speedUnit as _speedUnit,
  tempUnit as _tempUnit,
  fuelUnit as _fuelUnit,
  distanceUnit as _distanceUnit,
} from '../utils/telemetry-format';

import type { UnitSystem } from '../types/units';

class UnitsStore {
  system: UnitSystem = 'metric';

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setSystem(system: UnitSystem) {
    this.system = system;
  }

  formatSpeed(mps: number) {
    return _formatSpeed(mps, this.system);
  }

  formatTemp(celsius: number | null) {
    return _formatTemp(celsius, this.system);
  }

  formatFuel(liters: number) {
    return _formatFuel(liters, this.system);
  }

  formatDistance(meters: number) {
    return _formatDistance(meters, this.system);
  }

  get speedUnit() {
    return _speedUnit(this.system);
  }

  get tempUnit() {
    return _tempUnit(this.system);
  }

  get fuelUnit() {
    return _fuelUnit(this.system);
  }

  get distanceUnit() {
    return _distanceUnit(this.system);
  }
}

export const unitsStore = new UnitsStore();
