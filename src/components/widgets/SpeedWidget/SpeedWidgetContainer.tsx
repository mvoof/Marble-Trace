import { useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import { SpeedWidget } from './SpeedWidget';
import { parsePitSpeedLimitMs } from './speed-utils';

const KPH_TO_MS = 1 / 3.6;

export const SpeedWidgetContainer = observer(() => {
  const frame = telemetryStore.carDynamics;
  const carStatus = telemetryStore.carStatus;
  const driverInfo = telemetryStore.driverInfo;
  const weekendInfo = telemetryStore.weekendInfo;
  const { formatSpeed, speedUnit } = unitsStore;
  const settings = widgetSettingsStore.getSpeedSettings();

  const speed = frame ? formatSpeed(frame.speed) : '0';
  const speedMs = frame?.speed ?? 0;
  const rpm = frame ? Math.round(frame.rpm) : 0;
  const gear = frame?.gear ?? 0;
  const shiftIndicatorPct = frame?.shift_indicator_pct ?? 0;
  const isOnPitRoad = carStatus?.on_pit_road ?? false;

  const pitLimitMs =
    settings.pitSpeedLimitOverride !== null
      ? settings.pitSpeedLimitOverride * KPH_TO_MS
      : parsePitSpeedLimitMs(weekendInfo?.TrackPitSpeedLimit ?? null);

  const isOverPitLimit = isOnPitRoad && pitLimitMs > 0 && speedMs > pitLimitMs;
  const pitLimitFormatted = pitLimitMs > 0 ? formatSpeed(pitLimitMs) : '—';

  const initialMax =
    driverInfo?.DriverCarSLShiftRPM || driverInfo?.DriverCarRedLine || 10000;
  const maxShiftRpmRef = useRef(initialMax);
  const hasRefinedRef = useRef(false);
  const lastDriverInfoRef = useRef(driverInfo);

  if (lastDriverInfoRef.current !== driverInfo) {
    maxShiftRpmRef.current = initialMax;
    hasRefinedRef.current = false;
    lastDriverInfoRef.current = driverInfo;
  }

  if (shiftIndicatorPct >= 1 && rpm > 0) {
    if (!hasRefinedRef.current || rpm > maxShiftRpmRef.current) {
      maxShiftRpmRef.current = rpm;
      hasRefinedRef.current = true;
    }
  }

  return (
    <SpeedWidget
      speed={speed}
      speedUnit={speedUnit}
      rpm={rpm}
      gear={gear}
      shiftIndicatorPct={shiftIndicatorPct}
      maxShiftRpm={maxShiftRpmRef.current || initialMax}
      settings={settings}
      isOnPitRoad={isOnPitRoad}
      isOverPitLimit={isOverPitLimit}
      pitLimitFormatted={pitLimitFormatted}
    />
  );
});
