export interface EnvelopePoint {
  r: number;
  color: string;
}

export interface TrailPoint {
  lat: number;
  lon: number;
  color: string;
  /** `performance.now()` of the frame it was taken on — the trail is cut by age. */
  atMs: number;
}
