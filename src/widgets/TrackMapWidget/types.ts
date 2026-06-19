import type { TrackSurface } from '@/types/bindings';

export interface CarOnTrack {
  carIdx: number;
  carNumber: string;
  carClassColor: string;
  carClassId: number;
  lapDistPct: number;
  trackSurface: TrackSurface | number;
  isPlayer: boolean;
  position: number;
  classPosition: number;
}

interface StoredTrackData {
  rotation?: number;
}

export interface StoredTracks {
  [trackId: string]: StoredTrackData;
}

export const TRACKS_STORE_KEY = 'recorded-tracks';
