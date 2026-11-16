import { makeAutoObservable, runInAction } from 'mobx';

import type { LapChannelData } from '@shared/api/lap-analysis.service';
import { ChartViewport } from '@shared/lib/chart-viewport';
import { originOf, projectPath, type ProjectedPath } from './map-projection';
import { DELTA_CHANNEL, ELAPSED_CHANNEL, deltaValues } from './channel-looks';

import type {
  AnalysisLap,
  AnalysisLoad,
  AnalysisSet,
  CarSetupView,
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
  deleteSession: (key: string, deleteFiles: boolean) => Promise<AnalysisSet>;
  setAnalysisLapColor: (lap: LapRef, color: string) => Promise<AnalysisSet>;
  setAnalysisLapVisible: (
    lap: LapRef,
    visible: boolean
  ) => Promise<AnalysisSet>;
  setAnalysisReference: (lap: LapRef) => Promise<AnalysisSet>;
  loadAnalysisLaps: (laps: LapRef[]) => Promise<AnalysisLoad>;
  unloadAnalysis: () => Promise<void>;
  getCarSetup: (path: string) => Promise<CarSetupView>;
  getLapChannels: (
    laps: LapRef[],
    channels: string[]
  ) => Promise<LapChannelData>;
}

/** Channels on the grid: per channel, a value array per lap of `laps`. */
export interface ChartData {
  points: number;
  laps: LapRef[];
  byChannel: Map<string, Float32Array[]>;
}

/** Where on the earth each point was: the map draws the laps from them. */
export const MAP_CHANNELS = ['Lat', 'Lon'];

/**
 * The file channels the charts and the map need: the delta reads the time
 * since the line.
 */
export const fileChannelsFor = (charts: string[]): string[] => {
  const channels = charts.filter((name) => name !== DELTA_CHANNEL);

  if (charts.includes(DELTA_CHANNEL)) {
    channels.push(ELAPSED_CHANNEL);
  }

  channels.push(...MAP_CHANNELS);

  return [...new Set(channels)];
};

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

/** `stats.db` keeps the lap's telemetry, or its file is still on disk. */
export const hasTelemetry = (lap: { filePresent: boolean; stored: boolean }) =>
  lap.stored || lap.filePresent;

/** A lap the analysis can take: timed, from the line, off pit road, its telemetry kept. */
export const isAnalysable = (lap: SessionLap) =>
  lap.timeS !== null && !lap.partial && !lap.inPit && hasTelemetry(lap);

const EMPTY_SET: AnalysisSet = { session: null, laps: [], sectors: [] };

/** The analysis page's tabs. */
export type AnalysisTab = 'telemetry' | 'setup';

/** What the setup tab shows: the backend's answer, or why there is none yet. */
export type SetupState =
  | CarSetupView
  | { state: 'loading' }
  | { state: 'unreadable' };

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

  chartData: ChartData | null = null;
  /** The stretch shown and the cursor, shared by the charts and the map. */
  readonly viewport = new ChartViewport();

  tab: AnalysisTab = 'telemetry';
  /** The setup of `setupPath`'s file; `null` without laps. */
  setup: SetupState | null = null;

  /** Answers older than the latest telemetry request are dropped. */
  private telemetryRequest = 0;
  private chartRequest = 0;
  private setupRequest = 0;

  constructor(private api: LapAnalysisApi) {
    makeAutoObservable<
      LapAnalysisStore,
      'api' | 'telemetryRequest' | 'chartRequest' | 'setupRequest'
    >(this, {
      api: false,
      telemetryRequest: false,
      chartRequest: false,
      setupRequest: false,
      viewport: false,
    });
  }

  setTab(tab: AnalysisTab) {
    this.tab = tab;
  }

  /**
   * The file the setup tab shows: the reference lap's, else the first lap's;
   * `null` without laps.
   */
  get setupPath(): string | null {
    return (this.reference ?? this.set.laps.at(0))?.lap.path ?? null;
  }

  /** Reads the setup of `setupPath`'s file; the last file's goes at once. */
  async fetchSetup() {
    this.setupRequest += 1;
    const request = this.setupRequest;
    const path = this.setupPath;

    if (path === null) {
      this.setup = null;

      return;
    }

    this.setup = { state: 'loading' };

    try {
      const view = await this.api.getCarSetup(path);

      runInAction(() => {
        if (request === this.setupRequest) {
          this.setup = view;
        }
      });
    } catch (error) {
      console.warn('Car setup not read', error);
      runInAction(() => {
        if (request === this.setupRequest) {
          this.setup = { state: 'unreadable' };
        }
      });
    }
  }

  get holdsTelemetry(): boolean {
    return holdsTelemetry(this.gate);
  }

  /**
   * Each lap of the set on the map, in the set's order, centred on the
   * reference lap's first fix; `null` before the positions are fetched.
   */
  get mapPaths(): { laps: (ProjectedPath | null)[]; reference: number } | null {
    const lats = this.chartValues('Lat');
    const lons = this.chartValues('Lon');

    if (lats === null || lons === null) {
      return null;
    }

    const reference = Math.max(
      this.set.laps.findIndex((lap) => lap.reference),
      0
    );
    const origin = originOf(lats[reference], lons[reference]);

    if (origin === null) {
      return null;
    }

    return {
      reference,
      laps: lats.map((lat, index) =>
        this.isMissing(this.set.laps[index].lap)
          ? null
          : projectPath(lat, lons[index], origin)
      ),
    };
  }

  /** Where each sector starts on the grid, metres; the first is 0. */
  get sectorStartsM(): number[] {
    return this.set.sectors.map((start) => start * this.viewport.lengthM);
  }

  /** The charts' distance grid: a point a metre from the line. */
  get chartDistances(): Float64Array {
    const points = this.chartData?.points ?? 0;

    return Float64Array.from({ length: points }, (_, metre) => metre);
  }

  /** A chart's values per lap of the set, in the set's order; the delta is
   *  each lap's time minus the reference's. `null` until fetched. */
  chartValues(channel: string): Float32Array[] | null {
    const data = this.chartData;

    if (data === null) {
      return null;
    }

    const ordered = (name: string) => {
      const values = data.byChannel.get(name);

      if (values === undefined) {
        return null;
      }

      return this.set.laps.map((lap) => {
        const index = data.laps.findIndex((fetched) =>
          sameLap(fetched, lap.lap)
        );

        return values[index] ?? new Float32Array(data.points);
      });
    };

    if (channel !== DELTA_CHANNEL) {
      return ordered(channel);
    }

    const elapsed = ordered(ELAPSED_CHANNEL);
    const referenceIndex = this.set.laps.findIndex((lap) => lap.reference);

    if (elapsed === null || referenceIndex < 0) {
      return null;
    }

    return elapsed.map((times) => deltaValues(times, elapsed[referenceIndex]));
  }

  /** Asks for the channels the charts draw, of every lap held. */
  async fetchCharts(charts: string[]) {
    this.chartRequest += 1;
    const request = this.chartRequest;
    const laps = this.set.laps
      .map((lap) => lap.lap)
      .filter((lap) => !this.isMissing(lap));
    const channels = fileChannelsFor(charts);

    if (this.telemetry !== 'ready' || laps.length === 0) {
      this.chartData = null;

      return;
    }

    try {
      const fetched = await this.api.getLapChannels(laps, channels);

      runInAction(() => {
        if (request === this.chartRequest) {
          if (fetched.points - 1 !== this.viewport.lengthM) {
            this.viewport.setLength(fetched.points - 1);
            this.viewport.setRange(null, 'chart');
          }

          this.chartData = {
            points: fetched.points,
            laps,
            byChannel: new Map(
              channels.map((name, index) => [
                name,
                fetched.values.map((lapValues) => lapValues[index]),
              ])
            ),
          };
        }
      });
    } catch (error) {
      console.warn('Chart channels not loaded', error);
    }
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
      this.chartData = null;
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

  /**
   * Drops the modal's session from the database, its `.ibt` files with it
   * when asked, and closes the modal. Answers whether it went.
   */
  async deleteSession(deleteFiles: boolean): Promise<boolean> {
    const key = this.modalKey;

    if (key === null) {
      return false;
    }

    try {
      const set = await this.api.deleteSession(key, deleteFiles);

      runInAction(() => {
        this.set = set;

        if (this.modalKey === key) {
          this.closeSession();
        }
      });

      return true;
    } catch (error) {
      console.error('Session not deleted', error);

      return false;
    }
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
