import { makeAutoObservable } from 'mobx';

import type { CarIdxFrame, CarPositionsFrame } from '@/types/bindings';

export class CarsStore {
  carIdx: CarIdxFrame | null = null;
  carPositions: CarPositionsFrame | null = null;

  constructor() {
    makeAutoObservable(this);
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
