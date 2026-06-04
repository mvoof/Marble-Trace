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

    // Lap number we're waiting to confirm and record. Set when `lap` increments,
    // cleared after the entry is written to history.
    let pendingLapNum: number | null = null;

    // Time of the last successfully recorded lap. Used to detect when
    // lap_last_lap_time has updated to the NEW completed lap's value.
    //
    // WHY this instead of prev.lap_last_lap_time:
    // iRacing sometimes updates lap_last_lap_time one telemetry frame BEFORE
    // the `lap` counter increments (esp. on best-lap finish). In that case
    // prev.lap_last_lap_time already holds the NEW time, so comparing against
    // it would never detect the change. lastRecordedLapTime always holds what
    // we last wrote, so it stays one lap behind and the comparison is reliable.
    let lastRecordedLapTime: number = -1;

    const resetLocals = () => {
      pendingLapNum = null;
      lastRecordedLapTime = -1;
    };

    reaction(
      () => this.telemetry.lapTiming,
      (frame) => {
        const prev = prevFrame;
        prevFrame = frame;

        if (!frame || !prev) return;

        const lapNum = frame.lap ?? 0;
        const prevLapNum = prev.lap ?? 0;

        // Lap counter went backwards — session reset or restart.
        if (lapNum < prevLapNum) {
          resetLocals();
          runInAction(() => this.reset());
          return;
        }

        if (lapNum > prevLapNum) {
          const completedLapNum = lapNum - 1;

          // completedLapNum === 0 means the outlap just ended; no time to record.
          if (completedLapNum === 0) return;

          // A pending lap that never resolved (lap_last_lap_time never updated).
          // This can happen on an instant session restart — record it as invalid.
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
        }

        if (pendingLapNum !== null) {
          const rawLapTime = frame.lap_last_lap_time ?? -1;
          const currentLapTime = frame.lap_current_lap_time ?? 0;

          // 0 means lap_last_lap_time is not yet initialised — keep waiting.
          if (rawLapTime === 0) return;

          // lap_last_lap_time still shows the previous lap's time — SDK hasn't
          // updated it yet. Keep waiting.
          // After 1 s we fall through anyway: this handles the extremely rare
          // case where two consecutive laps have the exact same float time.
          if (rawLapTime === lastRecordedLapTime && currentLapTime < 1.0)
            return;

          // Negative means the lap was invalidated (pit, SC, penalty, reset).
          if (rawLapTime < 0) {
            const invalidLapNum = pendingLapNum;
            pendingLapNum = null;

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
          lastRecordedLapTime = lapTime;

          const bestLapTime = frame.lap_best_lap_time ?? 0;
          // isBest: lap_best_lap_time and lap_last_lap_time update together when
          // a new best is set, so a direct equality check is reliable here.
          const isBest = bestLapTime > 0 && lapTime === bestLapTime;
          const delta =
            bestLapTime > 0 && !isBest ? lapTime - bestLapTime : null;

          runInAction(() => {
            this.lastCompletedLap = { lapNum: completedLapNum, delta };

            // Clear isBest on all previous entries when a new best is set.
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
          resetLocals();
          runInAction(() => this.reset());
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
