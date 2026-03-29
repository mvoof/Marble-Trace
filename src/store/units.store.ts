import { makeAutoObservable, runInAction } from 'mobx';
import { load, Store } from '@tauri-apps/plugin-store';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';

export type UnitSystem = 'metric' | 'imperial';

class UnitsStore {
  system: UnitSystem = 'metric';

  private store: Store | null = null;
  private unlisten: UnlistenFn | null = null;

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

  async initWidgetListener() {
    this.unlisten = await listen<UnitSystem>('units-changed', (event) => {
      runInAction(() => {
        this.system = event.payload;
      });
    });
  }

  dispose() {
    this.unlisten?.();
  }

  private async saveSettings() {
    if (!this.store) return;

    await this.store.set('system', this.system);
    await this.store.save();
  }
}

export const unitsStore = new UnitsStore();
