import { useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import { SpeedWidget } from './SpeedWidget';
import { parsePitSpeedLimitMs, isEngineTempWarning } from './speed-utils';

const KPH_TO_MS = 1 / 3.6;

export const SpeedWidgetContainer = observer(() => {
  const frame = telemetryStore.carDynamics;
  const carStatus = telemetryStore.carStatus;
  const driverInfo = telemetryStore.driverInfo;
  const weekendInfo = telemetryStore.weekendInfo;
  const { formatSpeed, speedUnit, formatTemp, tempUnit } = unitsStore;
  const settings = widgetSettingsStore.getSpeedSettings();

  const speed = frame ? formatSpeed(frame.speed) : '0';
  const speedMs = frame?.speed ?? 0;
  const rpm = frame ? Math.round(frame.rpm) : 0;
  const gear = frame?.gear ?? 0;
  const shiftIndicatorPct = frame?.shift_indicator_pct ?? 0;
  const isOnPitRoad = carStatus?.on_pit_road ?? false;
  const oilTemp = formatTemp(carStatus?.oil_temp ?? null);
  const waterTemp = formatTemp(carStatus?.water_temp ?? null);
  const oilTempWarn = isEngineTempWarning(carStatus?.oil_temp);
  const waterTempWarn = isEngineTempWarning(carStatus?.water_temp);

  const pitLimitMs =
    settings.pitSpeedLimitOverride !== null
      ? settings.pitSpeedLimitOverride * KPH_TO_MS
      : parsePitSpeedLimitMs(weekendInfo?.TrackPitSpeedLimit ?? null);

  const pitLimitFormatted = pitLimitMs > 0 ? formatSpeed(pitLimitMs) : '—';

  const PIT_LIMITER_BIT = 0x10;
  const pitLimiterActive =
    ((carStatus?.engine_warnings ?? 0) & PIT_LIMITER_BIT) !== 0;

  const pitSpeedDelta =
    pitLimitMs > 0 && (isOnPitRoad || pitLimiterActive)
      ? Math.round((speedMs - pitLimitMs) * (unitsStore.isMetric ? 3.6 : 2.237))
      : null;

  const pitState = (() => {
    if (pitLimitMs > 0 && speedMs > pitLimitMs) return 'over-limit' as const;
    if (pitLimiterActive) return 'limiter-active' as const;
    return 'pit-lane' as const;
  })();

  const initialMax =
    driverInfo?.DriverCarSLShiftRPM || driverInfo?.DriverCarRedLine || 10000;
  const maxShiftRpmRef = useRef(initialMax);
  const hasRefinedRef = useRef(false);
  const lastDriverInfoRef = useRef(driverInfo);

  const lastIsOnPitRoadRef = useRef(isOnPitRoad);

  if (lastDriverInfoRef.current !== driverInfo) {
    maxShiftRpmRef.current = initialMax;
    hasRefinedRef.current = false;
    lastDriverInfoRef.current = driverInfo;
  }

  if (lastIsOnPitRoadRef.current && !isOnPitRoad) {
    maxShiftRpmRef.current = initialMax;
    hasRefinedRef.current = false;
  }
  lastIsOnPitRoadRef.current = isOnPitRoad;

  if (shiftIndicatorPct >= 1 && rpm > 0 && !pitLimiterActive && !isOnPitRoad) {
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
      maxShiftRpm={maxShiftRpmRef.current || initialMax}
      settings={settings}
      isOnPitRoad={isOnPitRoad}
      pitLimiterActive={pitLimiterActive}
      pitState={pitState}
      pitLimitFormatted={pitLimitFormatted}
      pitSpeedDelta={pitSpeedDelta}
      oilTemp={oilTemp}
      waterTemp={waterTemp}
      tempUnit={tempUnit}
      oilTempWarn={oilTempWarn}
      waterTempWarn={waterTempWarn}
    />
  );
});
