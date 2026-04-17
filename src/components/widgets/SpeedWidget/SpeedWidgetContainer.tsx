import { useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import { SpeedWidget } from './SpeedWidget';

export const SpeedWidgetContainer = observer(() => {
  const frame = telemetryStore.carDynamics;
  const driverInfo = telemetryStore.driverInfo;
  const { formatSpeed, speedUnit } = unitsStore;
  const settings = widgetSettingsStore.getSpeedSettings();

  const speed = frame ? formatSpeed(frame.speed) : '0';
  const rpm = frame ? Math.round(frame.rpm) : 0;
  const gear = frame?.gear ?? 0;
  const shiftIndicatorPct = frame?.shift_indicator_pct ?? 0;

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
    />
  );
});
