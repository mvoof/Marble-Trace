import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SavedLayout } from '@shared/contracts/widget-settings';

const { saveTextFileAndReveal } = vi.hoisted(() => ({
  saveTextFileAndReveal: vi.fn(
    async (directory: string, fileName: string) =>
      `C:/app/${directory}/${fileName}`
  ),
}));

vi.mock('@shared/api/file-export.service', () => ({
  saveTextFileAndReveal,
  fileStamp: () => '2026-11-13_18-05',
}));

const { LayoutExportStore } = await import('./layout-export.store');

const RACE_LAYOUT = {
  id: 'layout-race',
  name: 'Race: 3 screens / night',
  createdAt: 1,
  monitors: [],
  widgets: [],
} as unknown as SavedLayout;

const STORED_RACE = { id: 'layout-race', name: 'stored form' };

const buildStore = () =>
  new LayoutExportStore({
    layouts: {
      byId: (id) => (id === RACE_LAYOUT.id ? RACE_LAYOUT : undefined),
    },
    encodeLayout: () => STORED_RACE,
  });

describe('LayoutExportStore', () => {
  beforeEach(() => {
    saveTextFileAndReveal.mockClear();
  });

  it('writes the layout in its stored form to a file named after it', async () => {
    const path = await buildStore().exportLayout('layout-race');

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
    const path = await buildStore().exportLayout('missing');

    expect(path).toBeNull();
    expect(saveTextFileAndReveal).not.toHaveBeenCalled();
  });

  it.each([
    ['Гонка ночью', 'гонка-ночью-2026-11-13_18-05.json'],
    ['***', 'layout-2026-11-13_18-05.json'],
  ])('names the file for "%s" as %s', async (name, expectedFileName) => {
    const store = new LayoutExportStore({
      layouts: { byId: () => ({ ...RACE_LAYOUT, name }) },
      encodeLayout: () => STORED_RACE,
    });

    await store.exportLayout('layout-race');

    expect(saveTextFileAndReveal.mock.calls[0]?.[1]).toBe(expectedFileName);
  });
});
