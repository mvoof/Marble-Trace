import { compareStructural, reaction, type IReactionDisposer } from 'mobx';

import type { MainRoot } from '@app/roots/main-root';
import { setTelemetrySettingsSilent } from '@shared/api/settings.service';
import type { TelemetrySettings } from '@shared/contracts/generated/bindings';
import {
  FUEL_SETTINGS,
  type FuelWidgetSettings,
} from '@widgets/fuel/settings-schema';

/**
 * What the telemetry runtime runs with: the app's car length and overlay rate,
 * and the fuel strategy of a fuel widget on screen — the backend keeps one
 * copy, so one instance speaks for them however many the layout holds: a
 * switched-on one first. With none, the shipped values stand.
 */
export const telemetrySettingsOf = (root: MainRoot): TelemetrySettings => {
  const fuelWidgets = root.liveWidgets.liveWidgets.filter(
    (widget) => widget.type === 'fuel'
  );
  const fuel =
    fuelWidgets.find((widget) => widget.userSettings.enabled) ?? fuelWidgets[0];
  const fuelSettings = fuel
    ? (fuel.userSettings as unknown as FuelWidgetSettings)
    : FUEL_SETTINGS.defaults;

  return {
    carLengthM: root.appSettings.appSettings.carLength,
    overlayUpdateHz: root.appSettings.appSettings.overlayUpdateHz,
    pitWarningLaps: fuelSettings.pitWarningLaps,
    fuelAvgWindow: fuelSettings.fuelAvgWindow,
    fuelCountYellowLaps: fuelSettings.countYellowFlagLaps,
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
