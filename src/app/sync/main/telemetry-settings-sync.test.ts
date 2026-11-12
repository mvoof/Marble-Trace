import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInAction, type IReactionDisposer } from 'mobx';

import { MainRoot } from '@app/roots/main-root';
import { DEFAULT_FUEL_STRATEGY } from '@shared/contracts/fuel-strategy';

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

  it('sends the settings whole on start, the shipped fuel strategy by default', () => {
    expect(setTelemetrySettingsSilent).toHaveBeenCalledTimes(1);
    expect(setTelemetrySettingsSilent).toHaveBeenCalledWith({
      carLengthM: root.appSettings.appSettings.carLength,
      overlayUpdateHz: root.appSettings.appSettings.overlayUpdateHz,
      pitWarningLaps: DEFAULT_FUEL_STRATEGY.fuelPitWarningLaps,
      fuelAvgWindow: DEFAULT_FUEL_STRATEGY.fuelAvgWindow,
      fuelCountYellowLaps: DEFAULT_FUEL_STRATEGY.fuelCountYellowFlagLaps,
    });
  });

  it('sends the fuel strategy from the app settings', () => {
    runInAction(() =>
      root.appSettings.update({
        fuelPitWarningLaps: 5,
        fuelAvgWindow: 4,
        fuelCountYellowFlagLaps: true,
      })
    );

    expect(setTelemetrySettingsSilent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pitWarningLaps: 5,
        fuelAvgWindow: 4,
        fuelCountYellowLaps: true,
      })
    );
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
