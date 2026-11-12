import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainRoot } from '@app/roots/main-root';
import { CURRENT_SCHEMA_VERSION } from '@shared/settings-schema/migrate';
import type {
  JsonValue,
  LoadedSettings,
} from '@shared/contracts/generated/bindings';

const LAST_GOOD_SAVED_AT = 1_700_000_000_000;

const settingsService = vi.hoisted(() => ({
  loadSettingsFile: vi.fn(),
  saveSettingsFile: vi.fn(() => Promise.resolve()),
  backupSettingsFile: vi.fn(() => Promise.resolve()),
  keepLastGoodSettings: vi.fn(() => Promise.resolve()),
  lastGoodSettingsSavedAt: vi.fn(() => Promise.resolve<number | null>(null)),
  logSettingsSnapshot: vi.fn(() => Promise.resolve()),
  deleteSettingsFile: vi.fn(() => Promise.resolve()),
  restoreLastGoodSettings: vi.fn(() => Promise.resolve()),
  setActiveEventsSilent: vi.fn(),
  setTelemetrySettingsSilent: vi.fn(),
}));

vi.mock('@shared/api/settings.service', () => settingsService);

vi.mock('@shared/api/events.service', () => ({
  emitLayoutActivated: vi.fn(),
  emitSessionLayoutsChanged: vi.fn(),
  emitToOverlays: vi.fn(),
  emitToOverlaysAndRemote: vi.fn(),
  listenTo: vi.fn(),
}));

const updaterService = vi.hoisted(() => ({
  relaunchApp: vi.fn(() => Promise.resolve()),
}));

vi.mock('@shared/api/updater.service', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...updaterService,
}));

const { createSaveHandle, hydrateFromDisk, offerLastGoodSettings } =
  await import('./persistence-sync');

const loadedFile = (settings: JsonValue): LoadedSettings => ({
  status: 'loaded',
  settings,
});

const UNREADABLE_FILE = { status: 'unreadable' } as const;
const MISSING_FILE = { status: 'missing' } as const;

describe('the last-good settings copy', () => {
  let root: MainRoot;

  beforeEach(() => {
    vi.clearAllMocks();
    // Hydration resolves the `system` language from `navigator`, which Node
    // only has as a global from 21 — CI runs 20.
    vi.stubGlobal('navigator', { language: 'en-US' });
    root = new MainRoot({ skipInit: true });
  });

  afterEach(() => {
    root.dispose();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is kept after a current file loads', async () => {
    await hydrateFromDisk(
      root,
      loadedFile({ schemaVersion: CURRENT_SCHEMA_VERSION })
    );

    expect(root.appSettings.settingsLocked).toBe(false);
    expect(settingsService.keepLastGoodSettings).toHaveBeenCalledTimes(1);
  });

  it('is not replaced by a file that only loads after migrating', async () => {
    await hydrateFromDisk(root, loadedFile({ schemaVersion: 0 }));

    expect(root.appSettings.settingsLocked).toBe(false);
    expect(settingsService.keepLastGoodSettings).not.toHaveBeenCalled();
  });

  it('is not kept when there is no file yet', async () => {
    await hydrateFromDisk(root, MISSING_FILE);

    expect(root.appSettings.settingsLocked).toBe(false);
    expect(settingsService.keepLastGoodSettings).not.toHaveBeenCalled();
  });

  it.each([
    ['an unreadable file', UNREADABLE_FILE],
    [
      'a file that is not a settings object',
      loadedFile({ schemaVersion: 'x' }),
    ],
    [
      'a file from a newer build',
      loadedFile({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    ],
  ])('is never replaced by %s', async (_name, loaded) => {
    await hydrateFromDisk(root, loaded);

    expect(root.appSettings.settingsLocked).toBe(true);
    expect(settingsService.keepLastGoodSettings).not.toHaveBeenCalled();
  });

  it('is offered when the settings are locked as corrupt', async () => {
    settingsService.lastGoodSettingsSavedAt.mockResolvedValueOnce(
      LAST_GOOD_SAVED_AT
    );

    await hydrateFromDisk(root, UNREADABLE_FILE);
    await offerLastGoodSettings(root);

    expect(root.appSettings.settingsLockReason).toBe('corrupt');
    expect(root.appSettings.lastGoodSettingsSavedAt).toBe(LAST_GOOD_SAVED_AT);
  });

  it('is not offered for a file from a newer build', async () => {
    await hydrateFromDisk(
      root,
      loadedFile({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })
    );
    await offerLastGoodSettings(root);

    expect(settingsService.lastGoodSettingsSavedAt).not.toHaveBeenCalled();
    expect(root.appSettings.lastGoodSettingsSavedAt).toBeNull();
  });

  it('relaunches after a restore', async () => {
    await root.appSettings.restoreLastGoodSettings();

    expect(updaterService.relaunchApp).toHaveBeenCalledTimes(1);
    expect(root.appSettings.lastGoodRestoreStatus).toBe('idle');
  });

  it('stays and says so when a restore fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    settingsService.restoreLastGoodSettings.mockRejectedValueOnce(
      'restore failed'
    );

    await root.appSettings.restoreLastGoodSettings();

    expect(updaterService.relaunchApp).not.toHaveBeenCalled();
    expect(root.appSettings.lastGoodRestoreStatus).toBe('failed');
  });

  it('drops the restore and asks for a restart when only the relaunch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    updaterService.relaunchApp.mockRejectedValueOnce('relaunch failed');
    root.appSettings.setLastGoodSettingsSavedAt(LAST_GOOD_SAVED_AT);

    await root.appSettings.restoreLastGoodSettings();

    expect(root.appSettings.lastGoodRestoreStatus).toBe('restored');
    expect(root.appSettings.lastGoodSettingsSavedAt).toBeNull();
  });
});

describe('saving the settings file', () => {
  let root: MainRoot;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { language: 'en-US' });
    root = new MainRoot({ skipInit: true });
  });

  afterEach(() => {
    root.dispose();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes nothing while the settings are locked', async () => {
    root.appSettings.lockSettings('corrupt');

    await createSaveHandle(root)();

    expect(settingsService.saveSettingsFile).not.toHaveBeenCalled();
  });

  it('runs saves one after another, sharing the one that waits', async () => {
    let finishFirstSave = () => {};
    settingsService.saveSettingsFile.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishFirstSave = resolve;
      })
    );
    const save = createSaveHandle(root);

    const firstSave = save();
    await Promise.resolve();
    const secondSave = save();
    const thirdSave = save();

    expect(thirdSave).toBe(secondSave);
    expect(settingsService.saveSettingsFile).toHaveBeenCalledTimes(1);

    finishFirstSave();
    await Promise.all([firstSave, secondSave, thirdSave]);

    expect(settingsService.saveSettingsFile).toHaveBeenCalledTimes(2);
  });

  it('shares a save asked for before it starts', async () => {
    const save = createSaveHandle(root);

    await Promise.all([save(), save()]);

    expect(settingsService.saveSettingsFile).toHaveBeenCalledTimes(1);
  });

  it('keeps saving after one save fails', async () => {
    settingsService.saveSettingsFile.mockRejectedValueOnce('disk full');
    const save = createSaveHandle(root);

    await expect(save()).rejects.toBe('disk full');
    await save();

    expect(settingsService.saveSettingsFile).toHaveBeenCalledTimes(2);
  });
});
