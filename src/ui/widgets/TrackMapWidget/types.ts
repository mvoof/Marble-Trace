import type { PaceCarPitPhase } from '@/types/bindings';

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
