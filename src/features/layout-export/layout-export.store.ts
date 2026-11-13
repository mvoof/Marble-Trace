import { makeAutoObservable, runInAction } from 'mobx';

import {
  fileStamp,
  saveTextFileAndReveal,
} from '@shared/api/file-export.service';
import type { SavedLayout } from '@shared/contracts/widget-settings';

interface LayoutExportDeps {
  layouts: { byId: (id: string) => SavedLayout | undefined };
  /**
   * The layout as `settings.json` stores it. Handed in by the root: the
   * settings file format is the app's, and a later import reads the same shape.
   */
  encodeLayout: (layout: SavedLayout) => unknown;
}

const EXPORT_DIR = 'layouts';
const EXPORT_KIND = 'marble-trace-layout';
const FALLBACK_FILE_NAME = 'layout';
const JSON_INDENT = 2;
const NON_NAME_CHARACTERS = /[^\p{L}\p{N}]+/gu;
const EDGE_DASHES = /^-+|-+$/g;

const fileNameOf = (layoutName: string): string =>
  layoutName
    .toLowerCase()
    .replace(NON_NAME_CHARACTERS, '-')
    .replace(EDGE_DASHES, '') || FALLBACK_FILE_NAME;

/**
 * Writes one layout to its own file next to `settings.json` and shows it in
 * the file manager — something to keep, or to hand to another driver.
 */
export class LayoutExportStore {
  exportingId: string | null = null;

  private readonly deps: LayoutExportDeps;

  constructor(deps: LayoutExportDeps) {
    this.deps = deps;

    makeAutoObservable<LayoutExportStore, 'deps'>(
      this,
      { deps: false },
      { autoBind: true }
    );
  }

  /** The written file's path, or null when the layout is gone. */
  async exportLayout(id: string): Promise<string | null> {
    const layout = this.deps.layouts.byId(id);

    if (!layout) {
      return null;
    }

    this.exportingId = id;

    try {
      const contents = JSON.stringify(
        { kind: EXPORT_KIND, layout: this.deps.encodeLayout(layout) },
        null,
        JSON_INDENT
      );

      return await saveTextFileAndReveal(
        EXPORT_DIR,
        `${fileNameOf(layout.name)}-${fileStamp()}.json`,
        contents
      );
    } finally {
      runInAction(() => {
        this.exportingId = null;
      });
    }
  }
}
