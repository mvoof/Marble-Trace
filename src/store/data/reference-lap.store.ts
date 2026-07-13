import { makeAutoObservable } from 'mobx';

import type { ReferenceLapData, ReferenceLapSample } from '@/types/bindings';

const BUCKET_COUNT = 1000;

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
      Math.max(Math.floor(lapDistPct * BUCKET_COUNT), 0),
      BUCKET_COUNT - 1
    );

    return this.data.samples[bucket] ?? null;
  }

  /**
   * Linearly interpolated sample at `lapDistPct`, wrapping across the lap
   * boundary. Buckets store the value for the *interval* `[i/N, (i+1)/N)`, so
   * each bucket's value is treated as located at the interval center
   * `(i + 0.5)/N`; the continuous position between two centers is
   *
   *   x = lapDistPct * N - 0.5,   t = frac(x)
   *   value = sample[floor(x)] * (1 - t) + sample[floor(x) + 1] * t
   *
   * At ~5 m per bucket a car at 80 m/s crosses more than a bucket per 60 Hz
   * frame — nearest-bucket lookup steps by up to a full bucket, interpolation
   * removes that quantization from speed/throttle comparisons.
   */
  getInterpolatedSampleAtDistPct(
    lapDistPct: number
  ): ReferenceLapSample | null {
    if (!this.data) return null;

    const samples = this.data.samples;
    const position = lapDistPct * BUCKET_COUNT - 0.5;
    const lowerBucket =
      ((Math.floor(position) % BUCKET_COUNT) + BUCKET_COUNT) % BUCKET_COUNT;
    const upperBucket = (lowerBucket + 1) % BUCKET_COUNT;
    const t = position - Math.floor(position);

    const lower = samples[lowerBucket];
    const upper = samples[upperBucket];

    if (!lower || !upper) return lower ?? upper ?? null;

    const lerp = (a: number, b: number) => a * (1 - t) + b * t;

    return {
      speed: lerp(lower.speed, upper.speed),
      throttle: lerp(lower.throttle, upper.throttle),
      brake: lerp(lower.brake, upper.brake),
      latAccel:
        lower.latAccel !== null && upper.latAccel !== null
          ? lerp(lower.latAccel, upper.latAccel)
          : (lower.latAccel ?? upper.latAccel),
      steeringWheelAngle: lerp(
        lower.steeringWheelAngle,
        upper.steeringWheelAngle
      ),
    };
  }

  reset() {
    this.data = null;
  }
}
