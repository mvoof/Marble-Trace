import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainRoot } from '@app/roots/main-root';
import { CURRENT_SCHEMA_VERSION } from '@shared/settings-schema/migrate';

const LAST_GOOD_SAVED_AT = 1_700_000_000_000;

const settingsService = vi.hoisted(() => ({
  settingsFileExists: vi.fn(() => Promise.resolve(true)),
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

vi.mock('@tauri-apps/plugin-store', () => ({ load: vi.fn() }));

const updaterService = vi.hoisted(() => ({
  relaunchApp: vi.fn(() => Promise.resolve()),
}));

vi.mock('@shared/api/updater.service', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...updaterService,
}));

const { hydrateFromDisk, holdLockedSettings } =
  await import('./persistence-sync');

const createFileHandle = () => ({
  set: vi.fn(() => Promise.resolve()),
  save: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
});

describe('the last-good settings copy', () => {
  let root: MainRoot;

  beforeEach(() => {
    vi.clearAllMocks();
    root = new MainRoot({ skipInit: true });
  });

  afterEach(() => {
    root.dispose();
  });

  it('is kept after a current file loads', async () => {
    await hydrateFromDisk(root, {
      schemaVersion: CURRENT_SCHEMA_VERSION,
    } as never);

    expect(root.appSettings.settingsLocked).toBe(false);
    expect(settingsService.keepLastGoodSettings).toHaveBeenCalledTimes(1);
  });

  it('is not replaced by a file that only loads after migrating', async () => {
    await hydrateFromDisk(root, { schemaVersion: 0 } as never);

    expect(root.appSettings.settingsLocked).toBe(false);
    expect(settingsService.keepLastGoodSettings).not.toHaveBeenCalled();
  });

  it.each([
    ['a truncated file', undefined],
    ['a file that is not a settings object', { schemaVersion: 'x' }],
    [
      'a file from a newer build',
      { schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
    ],
  ])('is never replaced by %s', async (_name, loaded) => {
    await hydrateFromDisk(root, loaded as never);

    expect(root.appSettings.settingsLocked).toBe(true);
    expect(settingsService.keepLastGoodSettings).not.toHaveBeenCalled();
  });

  it('is offered when the settings are locked as corrupt', async () => {
    settingsService.lastGoodSettingsSavedAt.mockResolvedValueOnce(
      LAST_GOOD_SAVED_AT
    );
    const fileHandle = createFileHandle();

    await hydrateFromDisk(root, undefined);
    await holdLockedSettings(root, fileHandle);

    expect(fileHandle.close).toHaveBeenCalledTimes(1);
    expect(root.appSettings.lastGoodSettingsSavedAt).toBe(LAST_GOOD_SAVED_AT);
  });

  it('is not offered for a file from a newer build', async () => {
    const fileHandle = createFileHandle();

    await hydrateFromDisk(root, {
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    } as never);
    await holdLockedSettings(root, fileHandle);

    expect(fileHandle.close).toHaveBeenCalledTimes(1);
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
