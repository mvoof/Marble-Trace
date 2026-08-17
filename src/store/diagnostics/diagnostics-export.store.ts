import { makeAutoObservable, runInAction } from 'mobx';

import {
  fileStamp,
  saveTextFileAndReveal,
} from '@platform/services/file-export.service';
import type { RootStore } from '@store/root-store';
import { captureSnapshot } from './telemetry-snapshot';
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

  async saveTelemetrySnapshot(): Promise<string> {
    const snapshot = captureSnapshot(this.root);

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
