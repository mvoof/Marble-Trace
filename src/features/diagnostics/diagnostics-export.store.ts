import { makeAutoObservable, runInAction } from 'mobx';

import {
  fileStamp,
  saveTextFileAndReveal,
} from '@shared/api/file-export.service';
import type {
  RawSession,
  RawValue,
  RawVarMeta,
  SourceFrame,
} from '@shared/contracts/bindings';
import type { SessionStore } from '@entities/session/session.store';
import type { TelemetrySnapshot } from '@shared/contracts/telemetry-snapshot';
import type { FpsDiagnosticsStore } from './fps-diagnostics.store';
import { resultsToCsv } from './report';

/** What the inspector hands the export; the inspector is a sibling feature. */
interface SnapshotCapture {
  frame: SourceFrame | null;
  rawValues: Partial<Record<string, RawValue>> | null;
  rawVarMeta: RawVarMeta[];
  rawSession: RawSession | null;
}

interface DiagnosticsExportDeps {
  fpsDiagnostics: FpsDiagnosticsStore;
  /** The inspector's one-frame capture; the inspector is a sibling feature. */
  telemetryInspector: { captureOnce: () => Promise<SnapshotCapture> };
  session: SessionStore;
}

const EXPORT_DIR = 'diagnostics';
const JSON_INDENT = 2;

/**
 * Owns the two files a user is ever asked to produce: a diagnostics run and a
 * telemetry snapshot. They share a directory and a naming scheme on purpose —
 * both end up attached to the same kind of report.
 */
export class DiagnosticsExportStore {
  saving = false;
  lastSavedPath: string | null = null;

  private root: DiagnosticsExportDeps;

  constructor(root: DiagnosticsExportDeps) {
    this.root = root;

    makeAutoObservable(this, {}, { autoBind: true });
  }

  async saveResultsCsv(): Promise<string> {
    return this.save(
      `fps-diagnostics-${fileStamp()}.csv`,
      resultsToCsv(this.root.fpsDiagnostics.results)
    );
  }

  /**
   * The frame is pulled from the backend, not read out of this window's stores.
   * The settings window is not subscribed to the telemetry bundle, so those
   * stores hold only the fields that arrive on their own 1 Hz events — a capture
   * taken from them had null dynamics, inputs, per-car arrays and lap timing.
   *
   * `sessionInfo` still comes from the store: it arrives on `sim://session`,
   * which this window does receive.
   *
   * `raw` is the sim's own data at the same moment, so a report carries both
   * what the sim sent and what the app made of it.
   */
  async saveTelemetrySnapshot(): Promise<string> {
    const { frame, rawValues, rawVarMeta, rawSession } =
      await this.root.telemetryInspector.captureOnce();

    const snapshot: TelemetrySnapshot = {
      capturedAt: new Date().toISOString(),
      carDynamics: frame?.carDynamics ?? null,
      carIdx: frame?.carIdx ?? null,
      carInputs: frame?.carInputs ?? null,
      carStatus: frame?.carStatus ?? null,
      environment: frame?.environment ?? null,
      lapTiming: frame?.lapTiming ?? null,
      session: frame?.session ?? null,
      sessionInfo: this.root.session.sessionInfo,
      raw: {
        variables: rawVarMeta,
        values: rawValues,
        sessionYaml: rawSession?.yaml ?? null,
      },
    };

    return this.save(
      `telemetry-snapshot-${fileStamp()}.json`,
      JSON.stringify(snapshot, null, JSON_INDENT)
    );
  }

  private async save(fileName: string, contents: string): Promise<string> {
    this.saving = true;

    try {
      const path = await saveTextFileAndReveal(EXPORT_DIR, fileName, contents);

      runInAction(() => {
        this.lastSavedPath = path;
      });

      return path;
    } finally {
      runInAction(() => {
        this.saving = false;
      });
    }
  }
}
