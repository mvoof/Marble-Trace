import { compareStructural, reaction, type IReactionDisposer } from 'mobx';

import type { MainRoot } from '@app/roots/main-root';
import { setTelemetrySettingsSilent } from '@shared/api/settings.service';
import type { TelemetrySettings } from '@shared/contracts/generated/bindings';

/**
 * What the telemetry runtime runs with: the app's car length, overlay rate and
 * fuel strategy — app settings all, since the backend keeps one copy of each.
 */
export const telemetrySettingsOf = (root: MainRoot): TelemetrySettings => {
  const settings = root.appSettings.appSettings;

  return {
    carLengthM: settings.carLength,
    overlayUpdateHz: settings.overlayUpdateHz,
    pitWarningLaps: settings.fuelPitWarningLaps,
    fuelAvgWindow: settings.fuelAvgWindow,
    fuelCountYellowLaps: settings.fuelCountYellowFlagLaps,
  };
};

/**
 * Sends the telemetry settings whole, on start and on every change, so the
 * backend always runs on exactly what the settings say. Requires hydrated
 * stores: it fires immediately.
 */
export const registerTelemetrySettingsReaction = (
  root: MainRoot
): IReactionDisposer =>
  reaction(
    () => telemetrySettingsOf(root),
    (settings) => setTelemetrySettingsSilent(settings),
    { fireImmediately: true, equals: compareStructural }
  );
