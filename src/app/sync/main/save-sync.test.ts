import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInAction, type IReactionDisposer } from 'mobx';

import { MainRoot } from '@app/roots/main-root';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
} from '@entities/app-settings/app-settings.store';

// The stores reach the backend on some writes; that is not what is under test.
vi.mock('@shared/api/events.service', () => ({
  emitLayoutActivated: vi.fn(),
  emitSessionLayoutsChanged: vi.fn(),
  emitToOverlays: vi.fn(),
  emitToOverlaysAndRemote: vi.fn(),
  listenTo: vi.fn(),
}));

vi.mock('@shared/api/settings.service', () => ({
  setActiveEventsSilent: vi.fn(),
  setTelemetrySettingsSilent: vi.fn(),
}));

const { registerSaveReaction, SAVE_DEBOUNCE_MS } = await import('./save-sync');

/** A value of the same shape as `value`, but different from it. */
const changed = (value: unknown): unknown => {
  if (typeof value === 'boolean') {
    return !value;
  }

  if (typeof value === 'number') {
    return value + 1;
  }

  if (typeof value === 'string' || value === null) {
    return `${String(value)}-changed`;
  }

  if (Array.isArray(value)) {
    return [...value, { changed: true }];
  }

  return { ...(value as Record<string, unknown>), changed: true };
};

describe('the settings save trigger', () => {
  let root: MainRoot;
  let dispose: IReactionDisposer;
  const onSave = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.useFakeTimers();
    onSave.mockClear();
    root = new MainRoot({ skipInit: true });
    dispose = registerSaveReaction(root, onSave);
  });

  afterEach(() => {
    dispose();
    root.dispose();
    vi.useRealTimers();
  });

  it.each(Object.keys(DEFAULT_APP_SETTINGS) as Array<keyof AppSettings>)(
    'saves a change to %s',
    (key) => {
      runInAction(() => {
        root.appSettings.update({
          [key]: changed(root.appSettings.appSettings[key]),
        } as Partial<AppSettings>);
      });

      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

      expect(onSave).toHaveBeenCalledTimes(1);
    }
  );

  it('saves a burst of edits once', () => {
    runInAction(() => root.appSettings.update({ steeringLock: 540 }));
    runInAction(() => root.appSettings.update({ steeringLock: 720 }));
    runInAction(() => root.units.setSystem('imperial'));

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('saves a widget settings write', () => {
    runInAction(() => root.settingsMutations.record());

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('writes nothing while nothing changed', () => {
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 4);

    expect(onSave).not.toHaveBeenCalled();
  });
});
