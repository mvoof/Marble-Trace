import { makeAutoObservable } from 'mobx';
import { MPS_TO_KMH, MPS_TO_MPH } from '@utils/formatters/telemetry-format';
import type { UnitSystem } from '@/types';

export class UnitsStore {
  system: UnitSystem = 'metric';

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setSystem(system: UnitSystem) {
    this.system = system;
  }

  get isMetric() {
    return this.system === 'metric';
  }

  get speedFactor() {
    return this.system === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;
  }
}
