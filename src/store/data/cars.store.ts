import { makeAutoObservable, observable } from 'mobx';

import type { CarIdxFrame, CarPositionsFrame } from '@/types/bindings';

export class CarsStore {
  carIdx: CarIdxFrame | null = null;
  carPositions: CarPositionsFrame | null = null;

  // Every telemetry frame is replaced wholesale — nothing ever mutates one in
  // place — so `observable.ref` is all the reactivity these need. Deep
  // observability would rebuild a proxy for each frame, and for the per-car
  // arrays it would convert ~15 arrays of 64 entries on every tick, purely to
  // observe fields nobody writes.
  constructor() {
    makeAutoObservable(this, {
      carIdx: observable.ref,
      carPositions: observable.ref,
    });
  }

  get leaderBestLapTime(): number | null {
    const times = this.carIdx?.car_idx_best_lap_time;

    if (!times) {
      return null;
    }

    return times.reduce<number | null>((best, t) => {
      if (t > 0 && (best === null || t < best)) {
        return t;
      }

      return best;
    }, null);
  }

  updateCarIdx(frame: CarIdxFrame) {
    this.carIdx = frame;
  }

  updateCarPositions(frame: CarPositionsFrame) {
    this.carPositions = frame;
  }

  reset() {
    this.carIdx = null;
    this.carPositions = null;
  }
}
