import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { getGameDelta } from '@utils/widget/delta-utils';
import type { LapTimingFrame } from '@/types/bindings';
import type { LapDeltaReference } from '@/types/widget-settings';
import type { TelemetryStore } from './telemetry.store';

export type LapDeltas = Record<LapDeltaReference, number | null>;

export interface CompletedLap {
  lapNum: number;
  deltas: LapDeltas;
}

export interface LapHistoryEntry {
  lapNum: number;
  lapTime: number;
  deltas: LapDeltas;
  isBest: boolean;
}

const HISTORY_SIZE = 12;

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
  history: LapHistoryEntry[] = [];

  private prevSessionNum: number | null = null;

  constructor(private telemetry: TelemetryStore) {
    makeAutoObservable(this);
    this.initReactions();
  }

  private initReactions() {
    let prevFrame: LapTimingFrame | null = null;

    reaction(
      () => this.telemetry.lapTiming,
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
          const completedLapNum = lapNum - 1;

          if (completedLapNum === 0) return;

          const deltas = captureDeltas(prev);
          const lapTime = frame.lap_last_lap_time ?? 0;
          const bestLapTime = frame.lap_best_lap_time ?? 0;
          const isBest =
            lapTime > 0 && bestLapTime > 0 && lapTime === bestLapTime;

          runInAction(() => {
            this.lastCompletedLap = { lapNum: completedLapNum, deltas };

            const prevEntries = isBest
              ? this.history.map((entry) => ({ ...entry, isBest: false }))
              : this.history;

            this.history = [
              { lapNum: completedLapNum, lapTime, deltas, isBest },
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
