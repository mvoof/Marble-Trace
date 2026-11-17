import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SavedLayout } from '@shared/contracts/widget-settings';

const { saveTextFileAndReveal, pickLayoutFile, readLayoutFile } = vi.hoisted(
  () => ({
    saveTextFileAndReveal: vi.fn(
      async (directory: string, fileName: string) =>
        `C:/app/${directory}/${fileName}`
    ),
    pickLayoutFile: vi.fn(async (): Promise<string | null> => 'C:/race.json'),
    readLayoutFile: vi.fn(async (_path: string) => ''),
  })
);

vi.mock('@shared/api/file-export.service', () => ({
  saveTextFileAndReveal,
  fileStamp: () => '2026-11-13_18-05',
}));

vi.mock('@shared/api/layout-file.service', () => ({
  pickLayoutFile,
  readLayoutFile,
}));

const { LayoutFilesStore, LayoutImportError } =
  await import('./layout-files.store');

const RACE_LAYOUT = {
  id: 'layout-race',
  name: 'Race: 3 screens / night',
  createdAt: 1,
  monitors: [],
  widgets: [],
} as unknown as SavedLayout;

const STORED_RACE = { id: 'layout-race', name: 'stored form', monitors: [] };

const buildStore = () => {
  const addImportedLayout = vi.fn((_layout: SavedLayout) => 'layout-new');
  const decodeLayout = vi.fn((_stored: unknown) => RACE_LAYOUT);
  const store = new LayoutFilesStore({
    layouts: {
      byId: (id) => (id === RACE_LAYOUT.id ? RACE_LAYOUT : undefined),
      addImportedLayout,
    },
    encodeLayout: () => STORED_RACE,
    decodeLayout,
  });

  return { store, addImportedLayout, decodeLayout };
};

describe('LayoutFilesStore export', () => {
  beforeEach(() => {
    saveTextFileAndReveal.mockClear();
  });

  it('writes the layout in its stored form to a file named after it', async () => {
    const path = await buildStore().store.exportLayout('layout-race');

    expect(saveTextFileAndReveal).toHaveBeenCalledTimes(1);

    const [directory, fileName, contents] = saveTextFileAndReveal.mock
      .calls[0] as unknown as [string, string, string];

    expect(directory).toBe('layouts');
    expect(fileName).toBe('race-3-screens-night-2026-11-13_18-05.json');
    expect(JSON.parse(contents)).toEqual({
      kind: 'marble-trace-layout',
      layout: STORED_RACE,
    });
    expect(path).toBe(
      'C:/app/layouts/race-3-screens-night-2026-11-13_18-05.json'
    );
  });

  it('writes nothing for a layout that is gone', async () => {
    const path = await buildStore().store.exportLayout('missing');

    expect(path).toBeNull();
    expect(saveTextFileAndReveal).not.toHaveBeenCalled();
  });

  it.each([
    ['Гонка ночью', 'гонка-ночью-2026-11-13_18-05.json'],
    ['***', 'layout-2026-11-13_18-05.json'],
  ])('names the file for "%s" as %s', async (name, expectedFileName) => {
    const store = new LayoutFilesStore({
      layouts: {
        byId: () => ({ ...RACE_LAYOUT, name }),
        addImportedLayout: () => '',
      },
      encodeLayout: () => STORED_RACE,
      decodeLayout: () => RACE_LAYOUT,
    });

    await store.exportLayout('layout-race');

    expect(saveTextFileAndReveal.mock.calls[0]?.[1]).toBe(expectedFileName);
  });
});

describe('LayoutFilesStore import', () => {
  beforeEach(() => {
    pickLayoutFile.mockClear();
    readLayoutFile.mockReset();
  });

  it('adds the layout an exported file holds', async () => {
    readLayoutFile.mockResolvedValue(
      JSON.stringify({ kind: 'marble-trace-layout', layout: STORED_RACE })
    );
    const { store, addImportedLayout, decodeLayout } = buildStore();

    const id = await store.importLayout();

    expect(readLayoutFile).toHaveBeenCalledWith('C:/race.json');
    expect(decodeLayout).toHaveBeenCalledWith(STORED_RACE);
    expect(addImportedLayout).toHaveBeenCalledWith(RACE_LAYOUT);
    expect(id).toBe('layout-new');
  });

  it('does nothing when the dialog is closed', async () => {
    pickLayoutFile.mockResolvedValueOnce(null);
    const { store, addImportedLayout } = buildStore();

    expect(await store.importLayout()).toBeNull();
    expect(readLayoutFile).not.toHaveBeenCalled();
    expect(addImportedLayout).not.toHaveBeenCalled();
  });

  it.each([
    ['not JSON', 'hello'],
    ['another kind of file', JSON.stringify({ kind: 'settings', layout: {} })],
    [
      'a layout without monitors',
      JSON.stringify({ kind: 'marble-trace-layout', layout: { name: 'x' } }),
    ],
  ])('refuses %s', async (_case, contents) => {
    readLayoutFile.mockResolvedValue(contents);
    const { store, addImportedLayout } = buildStore();

    await expect(store.importLayout()).rejects.toBeInstanceOf(
      LayoutImportError
    );
    expect(addImportedLayout).not.toHaveBeenCalled();
  });
});
