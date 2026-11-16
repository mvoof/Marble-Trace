import { makeAutoObservable, runInAction } from 'mobx';

import type {
  AnalysisLap,
  AnalysisLoad,
  AnalysisSet,
  LapRef,
  SessionLap,
  SessionLaps,
} from '@shared/contracts/generated/bindings';

/** What the store asks the backend through. */
export interface LapAnalysisApi {
  getSessionLaps: (key: string) => Promise<SessionLaps | null>;
  getAnalysisSet: () => Promise<AnalysisSet>;
  addAnalysisLaps: (key: string, laps: LapRef[]) => Promise<AnalysisSet>;
  removeAnalysisLap: (lap: LapRef) => Promise<AnalysisSet>;
  setAnalysisLapColor: (lap: LapRef, color: string) => Promise<AnalysisSet>;
  setAnalysisLapVisible: (
    lap: LapRef,
    visible: boolean
  ) => Promise<AnalysisSet>;
  setAnalysisReference: (lap: LapRef) => Promise<AnalysisSet>;
  loadAnalysisLaps: (laps: LapRef[]) => Promise<AnalysisLoad>;
  unloadAnalysis: () => Promise<void>;
}

/**
 * Where the laps' telemetry is: none asked for, being read, in memory, or
 * dropped while the game runs and the window is away.
 */
export type TelemetryState = 'idle' | 'loading' | 'ready' | 'unloaded';

/** What the game rule looks at. */
export interface AnalysisGate {
  simConnected: boolean;
  windowFocused: boolean;
  keepWhileGameRuns: boolean;
}

/**
 * Whether the telemetry may stay in memory: not while the game runs and the
 * main window is in the background, unless the setting keeps it.
 */
export const holdsTelemetry = (gate: AnalysisGate) =>
  !gate.simConnected || gate.windowFocused || gate.keepWhileGameRuns;

export const sameLap = (first: LapRef, second: LapRef) =>
  first.path === second.path &&
  first.sessionNum === second.sessionNum &&
  first.lapNum === second.lapNum;

/** A lap the analysis can take: timed, from the line, off pit road, its file on disk. */
export const isAnalysable = (lap: SessionLap) =>
  lap.timeS !== null && !lap.partial && !lap.inPit && lap.filePresent;

const EMPTY_SET: AnalysisSet = { session: null, laps: [] };

/**
 * The analysis lap set, kept in the stats database, and the session modal
 * laps are picked from. Every change answers the set as the backend stored it.
 */
export class LapAnalysisStore {
  set: AnalysisSet = EMPTY_SET;
  /** The session whose laps the modal shows; `null` while it is closed. */
  modalKey: string | null = null;
  modalLaps: SessionLaps | null = null;

  telemetry: TelemetryState = 'idle';
  /** The last load's grid, channels and missing laps. */
  loaded: AnalysisLoad | null = null;
  gate: AnalysisGate = {
    simConnected: false,
    windowFocused: true,
    keepWhileGameRuns: false,
  };

  /** Answers older than the latest telemetry request are dropped. */
  private telemetryRequest = 0;

  constructor(private api: LapAnalysisApi) {
    makeAutoObservable<LapAnalysisStore, 'api' | 'telemetryRequest'>(this, {
      api: false,
      telemetryRequest: false,
    });
  }

  get holdsTelemetry(): boolean {
    return holdsTelemetry(this.gate);
  }

  /** The laps whose file is gone or does not hold them. */
  isMissing(lap: LapRef): boolean {
    return (this.loaded?.missing ?? []).some((missing) =>
      sameLap(missing, lap)
    );
  }

  setGate(gate: AnalysisGate) {
    this.gate = gate;
  }

  /**
   * Brings the telemetry in line with the set and the game rule: loads the
   * set's laps, or drops them.
   */
  async syncTelemetry() {
    this.telemetryRequest += 1;
    const request = this.telemetryRequest;
    const laps = this.set.laps.map((lap) => lap.lap);

    if (laps.length === 0 || !this.holdsTelemetry) {
      this.telemetry = laps.length === 0 ? 'idle' : 'unloaded';
      this.loaded = null;
      await this.api.unloadAnalysis().catch((error: unknown) => {
        console.error('Analysis not unloaded', error);
      });

      return;
    }

    this.telemetry = 'loading';

    try {
      const loaded = await this.api.loadAnalysisLaps(laps);

      runInAction(() => {
        if (request === this.telemetryRequest) {
          this.loaded = loaded;
          this.telemetry = 'ready';
        }
      });
    } catch (error) {
      // An unload cut it short; the newer request decides the state.
      console.warn('Analysis laps not loaded', error);
    }
  }

  get laps(): AnalysisLap[] {
    return this.set.laps;
  }

  get reference(): AnalysisLap | null {
    return this.set.laps.find((lap) => lap.reference) ?? null;
  }

  isInSet(lap: LapRef): boolean {
    return (
      this.set.session?.key === this.modalKey &&
      this.set.laps.some((added) => sameLap(added.lap, lap))
    );
  }

  async load() {
    await this.apply(this.api.getAnalysisSet());
  }

  async openSession(key: string) {
    this.modalKey = key;
    this.modalLaps = null;

    try {
      const laps = await this.api.getSessionLaps(key);

      runInAction(() => {
        if (this.modalKey === key) {
          this.modalLaps = laps;
        }
      });
    } catch (error) {
      console.error('Session laps not loaded', error);
    }
  }

  closeSession() {
    this.modalKey = null;
    this.modalLaps = null;
  }

  /** Adds laps of the modal's session; another session's set is replaced. */
  async addLaps(laps: LapRef[]) {
    const key = this.modalKey;

    if (key === null || laps.length === 0) {
      return;
    }

    await this.apply(this.api.addAnalysisLaps(key, laps));
  }

  /** Every lap of the modal's session the analysis can take. */
  async addAllLaps() {
    const laps = (this.modalLaps?.laps ?? [])
      .filter(isAnalysable)
      .map((lap) => lap.lap);

    await this.addLaps(laps);
  }

  async remove(lap: LapRef) {
    await this.apply(this.api.removeAnalysisLap(lap));
  }

  async setColor(lap: LapRef, color: string) {
    await this.apply(this.api.setAnalysisLapColor(lap, color));
  }

  async toggleVisible(lap: AnalysisLap) {
    await this.apply(this.api.setAnalysisLapVisible(lap.lap, !lap.visible));
  }

  async setReference(lap: LapRef) {
    await this.apply(this.api.setAnalysisReference(lap));
  }

  private async apply(request: Promise<AnalysisSet>) {
    try {
      const set = await request;

      runInAction(() => {
        this.set = set;
      });
    } catch (error) {
      console.error('Analysis set not changed', error);
    }
  }
}
