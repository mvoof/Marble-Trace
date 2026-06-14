import { makeAutoObservable } from 'mobx';
import { MPS_TO_KMH, MPS_TO_MPH } from '@utils/formatters/telemetry-format';
import type { UnitSystem } from '@/types';

export class UnitsStore {
  unitSystem: UnitSystem = 'metric';

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setSystem(system: UnitSystem) {
    this.unitSystem = system;
  }

  get isMetric() {
    return this.unitSystem === 'metric';
  }

  get speedFactor() {
    return this.unitSystem === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;
  }
}
