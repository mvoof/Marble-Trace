import type {
  CarDynamicsFrame,
  CarIdxFrame,
  CarInputsFrame,
  CarStatusFrame,
  EnvironmentFrame,
  LapTimingFrame,
  SessionFrame,
  SessionInfo,
} from '../types/bindings';

export interface TelemetrySnapshot {
  capturedAt: string;
  carDynamics: CarDynamicsFrame | null;
  carIdx: CarIdxFrame | null;
  carInputs: CarInputsFrame | null;
  carStatus: CarStatusFrame | null;
  environment: EnvironmentFrame | null;
  lapTiming: LapTimingFrame | null;
  session: SessionFrame | null;
  sessionInfo: SessionInfo | null;
}
