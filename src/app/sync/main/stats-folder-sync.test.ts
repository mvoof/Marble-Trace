import { describe, expect, it, vi, beforeEach } from 'vitest';
import { makeAutoObservable } from 'mobx';

import type { StatsFolder } from '@shared/contracts/generated/bindings';

const api = vi.hoisted(() => ({
  legacy: null as string | null,
  setStatsFolder: vi.fn(async (path: string | null): Promise<StatsFolder> => ({
    path: path ?? 'D:/Documents/iRacing/telemetry',
    isDefault: path === null,
  })),
}));

vi.mock('@shared/api/stats.service', () => ({
  setStatsFolder: api.setStatsFolder,
  takeLegacyStatsFolder: vi.fn(async () => api.legacy),
}));

const { adoptLegacyStatsFolder, registerStatsFolderReaction } =
  await import('./stats-folder-sync');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const rootWith = (statsFolder: string | null) => {
  const appSettings = makeAutoObservable({
    appSettings: { statsFolder },
    update(patch: { statsFolder: string | null }) {
      Object.assign(this.appSettings, patch);
    },
  });
  const statistics = {
    folder: null as StatsFolder | null,
    applyFolder(folder: StatsFolder) {
      this.folder = folder;
    },
  };

  return { appSettings, statistics } as unknown as Parameters<
    typeof adoptLegacyStatsFolder
  >[0];
};

describe('stats folder sync', () => {
  beforeEach(() => {
    api.legacy = null;
    api.setStatsFolder.mockClear();
  });

  it('moves the folder an older database held into settings that name none', async () => {
    api.legacy = 'E:/ibt';
    const root = rootWith(null);

    await adoptLegacyStatsFolder(root);

    expect(root.appSettings.appSettings.statsFolder).toBe('E:/ibt');
  });

  it('keeps the folder the settings already name', async () => {
    api.legacy = 'E:/ibt';
    const root = rootWith('F:/other');

    await adoptLegacyStatsFolder(root);

    expect(root.appSettings.appSettings.statsFolder).toBe('F:/other');
  });

  it('sends the folder at once and on every change, and keeps what the backend took', async () => {
    const root = rootWith(null);
    const dispose = registerStatsFolderReaction(root);
    await flush();

    expect(api.setStatsFolder).toHaveBeenLastCalledWith(null);
    expect(root.statistics.folder?.isDefault).toBe(true);

    root.appSettings.update({ statsFolder: 'E:/ibt' });
    await flush();

    expect(api.setStatsFolder).toHaveBeenLastCalledWith('E:/ibt');
    expect(root.statistics.folder).toEqual({
      path: 'E:/ibt',
      isDefault: false,
    });

    dispose();
  });
});
