import { makeAutoObservable, observable } from 'mobx';

import type { SimPerfFrame } from '@/types/bindings';

/**
 * The sim's own performance counters, arriving at 1 Hz.
 *
 * Only the FPS diagnostics runner reads them today: they are the sim's honest
 * report of what our overlay costs it, which nothing on our side can measure.
 */
export class SimPerfStore {
  simPerf: SimPerfFrame | null = null;

  constructor() {
    makeAutoObservable(this, { simPerf: observable.ref });
  }

  updateSimPerf(frame: SimPerfFrame) {
    this.simPerf = frame;
  }

  reset() {
    this.simPerf = null;
  }
}
