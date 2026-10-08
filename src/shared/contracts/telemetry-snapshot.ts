import type {
  CarDynamicsFrame,
  CarIdxFrame,
  CarInputsFrame,
  CarStatusFrame,
  EnvironmentFrame,
  LapTimingFrame,
  RawValue,
  RawVarMeta,
  SessionFrame,
  SessionSnapshot,
} from '@shared/contracts/bindings';

/**
 * A frozen copy of one telemetry tick: a fixture for previews and Storybook, and
 * an attachment when a user reports something the numbers should explain.
 *
 * The shape is flat and stays that way — `preview/sample-telemetry.ts`
 * reads a committed file in exactly this form, and a capture that no longer
 * loads into it is a fixture that cannot be used for the thing it exists for.
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
  /**
   * The sim's own data at the same moment, untouched: every variable under
   * iRacing's names with its declaration, and the session YAML as written.
   * Optional because the committed fixtures predate it; the preview reads only
   * the adapted fields above.
   */
  raw?: RawSnapshot;
}

export interface RawSnapshot {
  variables: RawVarMeta[];
  values: Partial<Record<string, RawValue>> | null;
  sessionYaml: string | null;
}
