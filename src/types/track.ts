export interface TrackPoint {
  x: number;
  y: number;
  pct: number; // lapDistPct at this point
}

export interface RecordedTrack {
  trackName: string;
  trackConfig: string;
  trackId: number;
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  recordedAt: string;
}

export interface TracksFile {
  tracks: Record<string, RecordedTrack>;
}
