import type {
  CarDynamicsFrame,
  CarIdxFrame,
  CarInputsFrame,
  CarStatusFrame,
  EnvironmentFrame,
  LapTimingFrame,
  SessionFrame,
  SessionSnapshot,
} from '@/types/bindings';

/**
 * A frozen copy of one telemetry tick: a fixture for previews and Storybook, and
 * an attachment when a user reports something the numbers should explain.
 *
 * The shape is flat and stays that way — `store/preview/sample-telemetry.ts` and
 * `storybook/test-data.ts` read a committed file in exactly this form, and a
 * capture that no longer loads into them is a fixture that cannot be used for
 * the thing it exists for.
 */
export interface TelemetrySnapshot {
  capturedAt: string;
  carDynamics: CarDynamicsFrame | null;
  carIdx: CarIdxFrame | null;
  carInputs: CarInputsFrame | null;
  carStatus: CarStatusFrame | null;
  environment: EnvironmentFrame | null;
  lapTiming: LapTimingFrame | null;
  session: SessionFrame | null;
  sessionInfo: SessionSnapshot | null;
}
