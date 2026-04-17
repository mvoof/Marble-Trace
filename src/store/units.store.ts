import { makeAutoObservable, runInAction } from 'mobx';
import { load, Store } from '@tauri-apps/plugin-store';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';

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

export type UnitSystem = 'metric' | 'imperial';

class UnitsStore {
  system: UnitSystem = 'metric';

  private store: Store | null = null;
  private overlayUnlisten: UnlistenFn | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async loadSettings() {
    this.store = await load('units-settings.json');
    const saved = await this.store.get<UnitSystem>('system');

    runInAction(() => {
      if (saved) {
        this.system = saved;
      }
    });
  }

  async setSystem(system: UnitSystem) {
    this.system = system;
    await this.saveSettings();
    emit('units-changed', system);
  }

  async initOverlayListener() {
    this.overlayUnlisten = await listen<UnitSystem>(
      'units-changed',
      (event) => {
        runInAction(() => {
          this.system = event.payload;
        });
      }
    );
  }

  disposeOverlayListener() {
    this.overlayUnlisten?.();
    this.overlayUnlisten = null;
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

  private async saveSettings() {
    if (!this.store) return;

    await this.store.set('system', this.system);
    await this.store.save();
  }
}

export const unitsStore = new UnitsStore();
