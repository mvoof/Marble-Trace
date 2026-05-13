import { useEffect, useRef } from 'react';
import { autorun, untracked } from 'mobx';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import { SpeedWidget, type SpeedDisplayHandle } from './SpeedWidget';
import { parsePitSpeedLimitMs, isEngineTempWarning } from './speed-utils';
import type { PitState } from './PitPanel/PitPanel';

export const SpeedWidgetContainer = observer(() => {
  const { formatSpeed, speedUnit, formatTemp, tempUnit, speedFactor } =
    unitsStore;

  const settings = widgetSettingsStore.getSpeedSettings();

  const carStatus = telemetryStore.carStatus;
  const driverInfo = telemetryStore.driverInfo;
  const weekendInfo = telemetryStore.weekendInfo;

  // These are relatively slow (4Hz-10Hz) or stable, so React can track them
  // to show/hide panels or update temperatures.
  const isOnPitRoad = carStatus?.on_pit_road ?? false;

  const oilTemp = formatTemp(carStatus?.oil_temp ?? null);
  const waterTemp = formatTemp(carStatus?.water_temp ?? null);

  const oilTempWarn = isEngineTempWarning(carStatus?.oil_temp);
  const waterTempWarn = isEngineTempWarning(carStatus?.water_temp);

  const PIT_LIMITER_BIT = 0x10;

  const pitLimiterActive =
    ((carStatus?.engine_warnings ?? 0) & PIT_LIMITER_BIT) !== 0;

  const pitLimitMs =
    settings.pitSpeedLimitOverride !== null
      ? settings.pitSpeedLimitOverride / speedFactor
      : parsePitSpeedLimitMs(weekendInfo?.TrackPitSpeedLimit ?? null);

  const pitLimitFormatted = pitLimitMs > 0 ? formatSpeed(pitLimitMs) : '—';

  const redLine = driverInfo?.DriverCarRedLine || 10000;
  // fallback to 90%/97% of redline when iRacing returns 0 for some cars
  const shiftRpm = driverInfo?.DriverCarSLShiftRPM || redLine * 0.9;
  const blinkRpm = driverInfo?.DriverCarSLBlinkRPM || redLine * 0.97;
  console.log({ shiftRpm, blinkRpm });

  const displayRef = useRef<SpeedDisplayHandle>(null);

  useEffect(() => {
    return autorun(() => {
      const frame = telemetryStore.carDynamics;
      const status = telemetryStore.carStatus; // Also track status in autorun for limiter

      if (!frame) return;

      const speed = frame.speed;

      const rpm = Math.round(frame.rpm);

      const isLimiter =
        ((status?.engine_warnings ?? 0) & PIT_LIMITER_BIT) !== 0;

      const onPitRoad = status?.on_pit_road ?? false;

      const pitSpeedDelta =
        pitLimitMs > 0 && (onPitRoad || isLimiter)
          ? Math.round((speed - pitLimitMs) * speedFactor)
          : null;

      const pitState: PitState = (() => {
        if (pitLimitMs > 0 && speed > pitLimitMs) return 'over-limit';
        if (isLimiter) return 'limiter-active';

        return 'pit-lane';
      })();

      displayRef.current?.update(
        formatSpeed(speed),
        rpm,
        frame.gear,
        pitState,
        pitSpeedDelta
      );
    });
  }, [formatSpeed, pitLimitMs, speedFactor]);

  const initialFrame = untracked(() => telemetryStore.carDynamics);
  const initialSpeed = initialFrame?.speed ?? 0;

  const initialPitSpeedDelta =
    pitLimitMs > 0 && (isOnPitRoad || pitLimiterActive)
      ? Math.round((initialSpeed - pitLimitMs) * speedFactor)
      : null;

  // TODO: move into useEffect
  const initialPitState: PitState = (() => {
    if (pitLimitMs > 0 && initialSpeed > pitLimitMs) return 'over-limit';

    if (pitLimiterActive) return 'limiter-active';

    return 'pit-lane';
  })();

  return (
    <SpeedWidget
      ref={displayRef}
      initialSpeed={initialFrame ? formatSpeed(initialFrame.speed) : '0'}
      initialRpm={initialFrame ? Math.round(initialFrame.rpm) : 0}
      initialGear={initialFrame?.gear ?? 0}
      speedUnit={speedUnit}
      shiftRpm={shiftRpm}
      blinkRpm={blinkRpm}
      settings={settings}
      isOnPitRoad={isOnPitRoad}
      pitLimiterActive={pitLimiterActive}
      initialPitState={initialPitState}
      pitLimitFormatted={pitLimitFormatted}
      initialPitSpeedDelta={initialPitSpeedDelta}
      oilTemp={oilTemp}
      waterTemp={waterTemp}
      tempUnit={tempUnit}
      oilTempWarn={oilTempWarn}
      waterTempWarn={waterTempWarn}
    />
  );
});
