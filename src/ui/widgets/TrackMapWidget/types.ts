import type { PaceCarPitPhase } from '@store/widgets/pace-car.widget';

/**
 * A car as the map draws it. Deliberately without a position: where the dot goes
 * changes on every tick and is read inside the draw reaction, so this value is
 * the same object for a whole lap. See `docs/rendering.md`.
 */
export interface CarOnTrack {
  carIdx: number;
  carNumber: string;
  carClassColor: string;
  carClassId: number;
  isPlayer: boolean;
  position: number;
  classPosition: number;
  isPaceCar?: boolean;
  pitPhase?: PaceCarPitPhase;
}

export type TrackRotateDirection = 'cw' | 'ccw';

interface StoredTrackData {
  rotation?: number;
}

export interface StoredTracks {
  [trackId: string]: StoredTrackData;
}

export const TRACKS_STORE_KEY = 'recorded-tracks';
