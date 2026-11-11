import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInAction, type IReactionDisposer } from 'mobx';

import { MainRoot } from '@app/roots/main-root';
import { FUEL_SETTINGS } from '@widgets/fuel/settings-schema';

vi.mock('@shared/api/events.service', () => ({
  emitLayoutActivated: vi.fn(),
  emitSessionLayoutsChanged: vi.fn(),
  emitToOverlays: vi.fn(),
  emitToOverlaysAndRemote: vi.fn(),
  listenTo: vi.fn(),
}));

const { setTelemetrySettingsSilent } = vi.hoisted(() => ({
  setTelemetrySettingsSilent: vi.fn(),
}));

vi.mock('@shared/api/settings.service', () => ({
  setActiveEventsSilent: vi.fn(),
  setTelemetrySettingsSilent,
}));

const { registerTelemetrySettingsReaction } =
  await import('./telemetry-settings-sync');

describe('the telemetry settings reaction', () => {
  let root: MainRoot;
  let dispose: IReactionDisposer;

  beforeEach(() => {
    setTelemetrySettingsSilent.mockClear();
    root = new MainRoot({ skipInit: true });
    dispose = registerTelemetrySettingsReaction(root);
  });

  afterEach(() => {
    dispose();
    root.dispose();
  });

  it('sends the settings whole on start, the shipped fuel values with no fuel widget', () => {
    expect(setTelemetrySettingsSilent).toHaveBeenCalledTimes(1);
    expect(setTelemetrySettingsSilent).toHaveBeenCalledWith({
      carLengthM: root.appSettings.appSettings.carLength,
      overlayUpdateHz: root.appSettings.appSettings.overlayUpdateHz,
      pitWarningLaps: FUEL_SETTINGS.defaults.pitWarningLaps,
      fuelAvgWindow: FUEL_SETTINGS.defaults.fuelAvgWindow,
      fuelCountYellowLaps: FUEL_SETTINGS.defaults.countYellowFlagLaps,
    });
  });

  it('sends them again when one changes, and not when nothing did', () => {
    runInAction(() => root.appSettings.update({ carLength: 5.1 }));
    runInAction(() => root.appSettings.update({ steeringLock: 540 }));

    expect(setTelemetrySettingsSilent).toHaveBeenCalledTimes(2);
    expect(setTelemetrySettingsSilent).toHaveBeenLastCalledWith(
      expect.objectContaining({ carLengthM: 5.1 })
    );
  });
});
