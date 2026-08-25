import { makeAutoObservable } from 'mobx';

import { REFERENCE_LAP_BUCKET_COUNT } from '@utils/backend-constants';
import type { ReferenceLapData, ReferenceLapSample } from '@/types/bindings';

export class ReferenceLapStore {
  data: ReferenceLapData | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  updateReferenceLap(data: ReferenceLapData) {
    this.data = data;
  }

  /** Nearest-bucket lookup — `lapDistPct` in `[0, 1)`. */
  getSampleAtDistPct(lapDistPct: number): ReferenceLapSample | null {
    if (!this.data) return null;

    const bucket = Math.min(
      Math.max(Math.floor(lapDistPct * REFERENCE_LAP_BUCKET_COUNT), 0),
      REFERENCE_LAP_BUCKET_COUNT - 1
    );

    return this.data.samples[bucket] ?? null;
  }

  reset() {
    this.data = null;
  }
}
