import { makeAutoObservable, observable } from 'mobx';

import type { DiagnosticsHudState } from '@/types/diagnostics';

/**
 * The banner window's copy of the run state.
 *
 * The banner is a separate Tauri window, so it has its own MobX instances and
 * cannot read the runner directly — it only ever receives what the main window
 * sends.
 */
export class DiagnosticsHudStore {
  state: DiagnosticsHudState | null = null;

  constructor() {
    makeAutoObservable(this, { state: observable.ref });
  }

  applyState(state: DiagnosticsHudState) {
    this.state = state;
  }
}
