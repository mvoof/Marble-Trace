import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { getGameDelta } from '@utils/widget/delta-utils';
import type { LapDeltaReference, LapTimingFrame } from '@/types/bindings';
import type { RootStore } from '../root-store';

export type LapDeltas = Record<LapDeltaReference, number | null>;

export interface CompletedLap {
  lapNum: number;
  lapTime: number;
  isBest: boolean;
  deltas: LapDeltas;
}

const REFERENCES: LapDeltaReference[] = [
  'personal_best',
  'personal_optimal',
  'session_best',
  'session_optimal',
  'session_last',
];

const toNullableDelta = (raw: number): number | null =>
  raw !== 0 ? raw : null;

const captureDeltas = (frame: LapTimingFrame | null): LapDeltas =>
  Object.fromEntries(
    REFERENCES.map((ref) => [ref, toNullableDelta(getGameDelta(frame, ref))])
  ) as LapDeltas;

export class LapStore {
  lastCompletedLap: CompletedLap | null = null;

  private prevSessionNum: number | null = null;

  constructor(private root: RootStore) {
    makeAutoObservable(this);
    this.initReactions();
  }

  private initReactions() {
    let prevFrame: LapTimingFrame | null = null;

    reaction(
      () => this.root.telemetry.lapTiming,
      (frame) => {
        const prev = prevFrame;
        prevFrame = frame;

        if (!frame || !prev) return;

        const lapNum = frame.lap ?? 0;
        const prevLapNum = prev.lap ?? 0;

        if (lapNum < prevLapNum) {
          runInAction(() => this.reset());
          return;
        }

        if (lapNum > prevLapNum) {
          const lastLapTime = frame.lap_last_lap_time;

          if (!lastLapTime || lastLapTime <= 0) return;

          const deltas = captureDeltas(prev);
          const bestLapTime = frame.lap_best_lap_time ?? null;

          runInAction(() => {
            this.lastCompletedLap = {
              lapNum: lapNum - 1,
              lapTime: lastLapTime,
              isBest: lastLapTime === bestLapTime,
              deltas,
            };
          });
        }
      }
    );

    reaction(
      () => this.root.telemetry.session?.session_num,
      (sessionNum) => {
        if (
          this.prevSessionNum !== null &&
          sessionNum !== this.prevSessionNum
        ) {
          this.reset();
        }

        this.prevSessionNum = sessionNum ?? null;
      }
    );
  }

  private reset() {
    this.lastCompletedLap = null;
  }
}
