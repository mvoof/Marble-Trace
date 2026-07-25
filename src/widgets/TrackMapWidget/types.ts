import type { TrackSurface } from '@/types/bindings';
import type { PaceCarPitPhase } from '@store/widgets/pace-car.widget';

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
  isPaceCar?: boolean;
  pitPhase?: PaceCarPitPhase;
}

interface StoredTrackData {
  rotation?: number;
}

export interface StoredTracks {
  [trackId: string]: StoredTrackData;
}

export const TRACKS_STORE_KEY = 'recorded-tracks';
