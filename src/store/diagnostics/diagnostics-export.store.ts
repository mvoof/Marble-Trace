import { makeAutoObservable, runInAction } from 'mobx';

import {
  fileStamp,
  saveTextFileAndReveal,
} from '@platform/services/file-export.service';
import type { RootStore } from '@store/root-store';
import type { TelemetrySnapshot } from '@/types/telemetry-snapshot';
import { resultsToCsv } from './report';

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

  private root: RootStore;

  constructor(root: RootStore) {
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
   */
  async saveTelemetrySnapshot(): Promise<string> {
    const frame = await this.root.telemetryInspector.captureOnce();

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
