import type { TrackPoint } from '../../../utils/track-recorder';

export interface CarOnTrack {
  carIdx: number;
  carNumber: string;
  carClassColor: string;
  carClassId: number;
  lapDistPct: number;
  trackSurface: number;
  isPlayer: boolean;
  position: number;
  classPosition: number;
}

export interface StoredTrackData {
  trackName: string;
  trackConfig: string;
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  recordedAt: string;
  version?: number;
}

export interface StoredTracks {
  [trackId: string]: StoredTrackData;
}

export const TRACKS_STORE_KEY = 'recorded-tracks';
export const TRACK_DATA_VERSION = 2;
