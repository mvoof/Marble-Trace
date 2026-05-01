import { makeAutoObservable } from 'mobx';

import type {
  CarDynamicsFrame,
  CarIdxFrame,
  CarInputsFrame,
  CarStatusFrame,
  ChassisFrame,
  EnvironmentFrame,
  LapTimingFrame,
  SessionFrame,
  SessionInfo,
  DriverInfoData,
  WeekendInfo,
  WeatherForecastEntry,
} from '../../types/bindings';

export interface CarPositionsFrame {
  car_idx_lap_dist_pct: number[];
  car_idx_track_surface: number[];
}
import type { SessionWithResults } from '../../types/session-results';

class TelemetryStore {
  carDynamics: CarDynamicsFrame | null = null;
  carIdx: CarIdxFrame | null = null;
  carInputs: CarInputsFrame | null = null;
  carPositions: CarPositionsFrame | null = null;
  carStatus: CarStatusFrame | null = null;
  chassis: ChassisFrame | null = null;
  environment: EnvironmentFrame | null = null;
  lapTiming: LapTimingFrame | null = null;
  session: SessionFrame | null = null;
  sessionInfo: SessionInfo | null = null;
  weatherForecast: WeatherForecastEntry[] = [];

  /**
   * Start positions for the current session, keyed by CarIdx.
   * Populated from Sessions[n].ResultsPositions on first valid snapshot.
   * Reset when session number changes.
   */
  startPositions: Map<number, { overall: number; class: number }> = new Map();

  private trackedSessionNum: number = -1;

  constructor() {
    makeAutoObservable(this);
  }

  get driverInfo(): DriverInfoData | null {
    return this.sessionInfo?.DriverInfo ?? null;
  }

  get weekendInfo(): WeekendInfo | null {
    return this.sessionInfo?.WeekendInfo ?? null;
  }

  /**
   * Returns how many positions a car has gained (positive) or lost (negative)
   * relative to its start position in the current session.
   * Returns 0 when start position is unknown or car has no current position.
   */
  posChange(carIdx: number): number {
    const startPos = this.startPositions.get(carIdx);
    const currentPos = this.carIdx?.car_idx_position[carIdx] ?? 0;
    if (!startPos || currentPos === 0) return 0;
    return startPos.overall - currentPos;
  }

  posChangeClass(carIdx: number): number {
    const startPos = this.startPositions.get(carIdx);
    const currentPos = this.carIdx?.car_idx_class_position?.[carIdx] ?? 0;
    if (!startPos || currentPos === 0) return 0;
    return startPos.class - currentPos;
  }

  updateCarDynamics(frame: CarDynamicsFrame) {
    this.carDynamics = frame;
  }

  updateCarIdx(frame: CarIdxFrame) {
    this.carIdx = frame;
  }

  updateCarInputs(frame: CarInputsFrame) {
    this.carInputs = frame;
  }

  updateCarPositions(frame: CarPositionsFrame) {
    this.carPositions = frame;
  }

  updateCarStatus(frame: CarStatusFrame) {
    this.carStatus = frame;
  }

  updateChassis(frame: ChassisFrame) {
    this.chassis = frame;
  }

  updateEnvironment(frame: EnvironmentFrame) {
    this.environment = frame;
  }

  updateLapTiming(frame: LapTimingFrame) {
    this.lapTiming = frame;
  }

  updateSession(frame: SessionFrame) {
    this.session = frame;
  }

  updateSessionInfo(info: SessionInfo) {
    this.sessionInfo = info;
    this.maybeSnapshotStartPositions(info);
  }

  updateWeatherForecast(entries: WeatherForecastEntry[]) {
    this.weatherForecast = entries;
  }

  reset() {
    this.carDynamics = null;
    this.carIdx = null;
    this.carInputs = null;
    this.carPositions = null;
    this.carStatus = null;
    this.chassis = null;
    this.environment = null;
    this.lapTiming = null;
    this.session = null;
    this.sessionInfo = null;
    this.weatherForecast = [];
    this.startPositions = new Map();
    this.trackedSessionNum = -1;
  }

  /**
   * Extracts start positions from Sessions[currentSessionNum].ResultsPositions.
   * Called each time sessionInfo updates. Snapshots once per session — resets
   * when the session number changes (practice → qualify → race transition).
   */
  private maybeSnapshotStartPositions(info: SessionInfo) {
    const currentSessionNum = info.SessionInfo?.CurrentSessionNum ?? -1;
    const sessions = (info.SessionInfo?.Sessions ?? []) as SessionWithResults[];
    const currentSession = sessions[currentSessionNum];
    const results = currentSession?.ResultsPositions;

    if (!results || results.length === 0) return;

    // Reset snapshot when session changes
    if (currentSessionNum !== this.trackedSessionNum) {
      this.startPositions = new Map();
      this.trackedSessionNum = currentSessionNum;
    }

    // Only snapshot once — don't overwrite after positions start changing
    if (this.startPositions.size > 0) return;

    const snapshot = new Map<number, { overall: number; class: number }>();
    for (const entry of results) {
      if (entry.CarIdx != null && entry.Position != null) {
        snapshot.set(entry.CarIdx, {
          overall: entry.Position + 1,
          class: (entry.ClassPosition ?? entry.Position) + 1,
        });
      }
    }

    if (snapshot.size > 0) {
      this.startPositions = snapshot;
    }
  }
}

export const telemetryStore = new TelemetryStore();
