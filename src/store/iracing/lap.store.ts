import { makeAutoObservable, reaction, runInAction } from 'mobx';
import type { LapTimingFrame } from '@/types/bindings';
import type { TelemetryStore } from './telemetry.store';

export interface CompletedLap {
  lapNum: number;
  delta: number | null;
}

export interface LapHistoryEntry {
  lapNum: number;
  lapTime: number | null;
  delta: number | null;
  isBest: boolean;
}

const HISTORY_SIZE = 12;

export class LapStore {
  lastCompletedLap: CompletedLap | null = null;
  history: LapHistoryEntry[] = [];

  private prevSessionNum: number | null = null;

  constructor(private telemetry: TelemetryStore) {
    makeAutoObservable(this);
    this.initReactions();
  }

  private initReactions() {
    let prevFrame: LapTimingFrame | null = null;
    let pendingLapNum: number | null = null;
    let pendingPrevLapTime: number | null = null;

    reaction(
      () => this.telemetry.lapTiming,
      (frame) => {
        const prev = prevFrame;
        prevFrame = frame;

        if (!frame || !prev) return;

        const lapNum = frame.lap ?? 0;
        const prevLapNum = prev.lap ?? 0;

        if (lapNum < prevLapNum) {
          pendingLapNum = null;
          pendingPrevLapTime = null;

          runInAction(() => this.reset());

          return;
        }

        if (lapNum > prevLapNum) {
          const completedLapNum = lapNum - 1;

          if (completedLapNum === 0) return;

          if (pendingLapNum !== null) {
            runInAction(() => {
              this.history = [
                {
                  lapNum: pendingLapNum!,
                  lapTime: null,
                  delta: null,
                  isBest: false,
                },
                ...this.history,
              ].slice(0, HISTORY_SIZE);
            });
          }

          pendingLapNum = completedLapNum;
          pendingPrevLapTime = prev.lap_last_lap_time ?? -1;
        }

        if (pendingLapNum !== null) {
          const rawLapTime = frame.lap_last_lap_time ?? -1;

          if (
            rawLapTime === 0 ||
            (pendingPrevLapTime !== null && rawLapTime === pendingPrevLapTime)
          )
            return;

          if (rawLapTime < 0) {
            const invalidLapNum = pendingLapNum;

            pendingLapNum = null;
            pendingPrevLapTime = null;

            runInAction(() => {
              this.history = [
                {
                  lapNum: invalidLapNum,
                  lapTime: null,
                  delta: null,
                  isBest: false,
                },
                ...this.history,
              ].slice(0, HISTORY_SIZE);
            });

            return;
          }

          const lapTime = rawLapTime;
          const completedLapNum = pendingLapNum;

          pendingLapNum = null;
          pendingPrevLapTime = null;

          const bestLapTime = frame.lap_best_lap_time ?? 0;
          const isBest = bestLapTime > 0 && lapTime === bestLapTime;

          const delta =
            bestLapTime > 0 && !isBest ? lapTime - bestLapTime : null;

          runInAction(() => {
            this.lastCompletedLap = { lapNum: completedLapNum, delta };

            const prevEntries = isBest
              ? this.history.map((entry) => ({ ...entry, isBest: false }))
              : this.history;

            this.history = [
              { lapNum: completedLapNum, lapTime, delta, isBest },
              ...prevEntries,
            ].slice(0, HISTORY_SIZE);
          });
        }
      }
    );

    reaction(
      () => this.telemetry.session?.session_num,
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
    this.history = [];
  }
}
