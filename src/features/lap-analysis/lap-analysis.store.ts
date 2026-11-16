import { makeAutoObservable, runInAction } from 'mobx';

import type {
  AnalysisLap,
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
}

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

  constructor(private api: LapAnalysisApi) {
    makeAutoObservable<LapAnalysisStore, 'api'>(this, { api: false });
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
