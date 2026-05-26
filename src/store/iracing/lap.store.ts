import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { getGameDelta } from '@utils/widget/delta-utils';
import type { LapTimingFrame } from '@/types/bindings';
import type { LapDeltaReference } from '@/types/widget-settings';
import type { RootStore } from '../root-store';

export type LapDeltas = Record<LapDeltaReference, number | null>;

export interface CompletedLap {
  lapNum: number;
  lapTime: number;
  deltas: LapDeltas;
}

const toNullableDelta = (raw: number): number | null =>
  raw !== 0 ? raw : null;

const captureDeltas = (frame: LapTimingFrame | null): LapDeltas => ({
  personal_best: toNullableDelta(getGameDelta(frame, 'personal_best')),
  personal_optimal: toNullableDelta(getGameDelta(frame, 'personal_optimal')),
  session_best: toNullableDelta(getGameDelta(frame, 'session_best')),
  session_optimal: toNullableDelta(getGameDelta(frame, 'session_optimal')),
  session_last: toNullableDelta(getGameDelta(frame, 'session_last')),
});

export class LapStore {
  lastCompletedLap: CompletedLap | null = null;

  private prevSessionNum: number | null = null;

  get isLastLapBest(): boolean {
    if (!this.lastCompletedLap) return false;
    const bestLapTime = this.root.telemetry.lapTiming?.lap_best_lap_time;
    return (
      bestLapTime != null &&
      bestLapTime > 0 &&
      this.lastCompletedLap.lapTime === bestLapTime
    );
  }

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

          runInAction(() => {
            this.lastCompletedLap = {
              lapNum: lapNum - 1,
              lapTime: lastLapTime,
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
