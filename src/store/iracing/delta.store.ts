import { makeAutoObservable, reaction } from 'mobx';
import { getGameDelta } from '@utils/widget/delta-utils';
import type { LapDeltaReference } from '@/types/widget-settings';
import type { RootStore } from '../root-store';

export type LapDeltas = Record<LapDeltaReference, number | null>;

export interface CompletedLap {
  lapNum: number;
  lapTime: number;
  isBest: boolean;
  deltas: LapDeltas;
}

const toNullableDelta = (raw: number): number | null =>
  raw !== 0 ? raw : null;

export class DeltaStore {
  lastCompletedLap: CompletedLap | null = null;

  private prevLastLapTime: number | null = null;
  private prevLapNum: number | null = null;
  private prevSessionNum: number | null = null;

  constructor(private root: RootStore) {
    makeAutoObservable(this);
    this.initReactions();
  }

  private initReactions() {
    reaction(
      () => this.root.telemetry.lapTiming?.lap_last_lap_time,
      (lastLapTime) => {
        if (!lastLapTime || lastLapTime <= 0) return;
        if (this.prevLastLapTime === lastLapTime) return;

        this.prevLastLapTime = lastLapTime;

        const lapTiming = this.root.telemetry.lapTiming;
        const lapNum = lapTiming?.lap ?? 1;
        const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

        const deltas: LapDeltas = {
          personal_best: toNullableDelta(
            getGameDelta(lapTiming, 'personal_best')
          ),
          personal_optimal: toNullableDelta(
            getGameDelta(lapTiming, 'personal_optimal')
          ),
          session_best: toNullableDelta(
            getGameDelta(lapTiming, 'session_best')
          ),
          session_optimal: toNullableDelta(
            getGameDelta(lapTiming, 'session_optimal')
          ),
          session_last: toNullableDelta(
            getGameDelta(lapTiming, 'session_last')
          ),
        };

        this.lastCompletedLap = {
          lapNum: lapNum - 1,
          lapTime: lastLapTime,
          isBest: lastLapTime === bestLapTime,
          deltas,
        };
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

    reaction(
      () => this.root.telemetry.lapTiming?.lap,
      (lapNum) => {
        if (lapNum == null) return;

        if (this.prevLapNum !== null && lapNum < this.prevLapNum) {
          this.reset();
        }

        this.prevLapNum = lapNum;
      }
    );
  }

  private reset() {
    this.lastCompletedLap = null;
    this.prevLastLapTime = null;
  }
}
