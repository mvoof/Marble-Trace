import { makeAutoObservable, runInAction } from 'mobx';

import {
  fileStamp,
  saveTextFileAndReveal,
} from '@shared/api/file-export.service';
import {
  pickLayoutFile,
  readLayoutFile,
} from '@shared/api/layout-file.service';
import type { SavedLayout } from '@shared/contracts/widget-settings';

interface LayoutFilesDeps {
  layouts: {
    byId: (id: string) => SavedLayout | undefined;
    addImportedLayout: (layout: SavedLayout) => string;
  };
  /**
   * The layout as `settings.json` stores it, and back. Handed in by the root:
   * the settings file format is the app's, and the file holds that shape.
   */
  encodeLayout: (layout: SavedLayout) => unknown;
  decodeLayout: (stored: never) => SavedLayout;
}

/** A picked file that holds no layout this app can read. */
export class LayoutImportError extends Error {
  constructor() {
    super('notALayout');
    this.name = 'LayoutImportError';
  }
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The stored layout an exported file holds, or a LayoutImportError. */
const storedLayoutIn = (contents: string): unknown => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new LayoutImportError();
  }

  if (
    !isRecord(parsed) ||
    parsed.kind !== EXPORT_KIND ||
    !isRecord(parsed.layout) ||
    !Array.isArray(parsed.layout.monitors)
  ) {
    throw new LayoutImportError();
  }

  return parsed.layout;
};

/**
 * A layout in a file of its own: written next to `settings.json` to keep or
 * hand to another driver, and read back from one.
 */
export class LayoutFilesStore {
  exportingId: string | null = null;

  private readonly deps: LayoutFilesDeps;

  constructor(deps: LayoutFilesDeps) {
    this.deps = deps;

    makeAutoObservable<LayoutFilesStore, 'deps'>(
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

  /**
   * Asks for a layout file and adds the layout it holds; its id, or null when
   * the dialog is closed. A file that is not one rejects with a
   * LayoutImportError.
   */
  async importLayout(): Promise<string | null> {
    const path = await pickLayoutFile();

    if (path === null) {
      return null;
    }

    const stored = storedLayoutIn(await readLayoutFile(path));
    const layout = this.deps.decodeLayout(stored as never);

    return runInAction(() => this.deps.layouts.addImportedLayout(layout));
  }
}
