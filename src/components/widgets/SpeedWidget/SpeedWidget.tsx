import { useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import { formatGear } from '../../../utils/telemetry-format';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { GearCircle } from './GearCircle/GearCircle';
import { getShiftZoneColor } from './speed-utils';

import styles from './SpeedWidget.module.scss';

export const SpeedWidget = observer(() => {
  const frame = telemetryStore.carDynamics;
  const driverInfo = telemetryStore.driverInfo;
  const { formatSpeed, speedUnit } = unitsStore;
  const settings = widgetSettingsStore.getSpeedSettings();

  const speed = frame ? formatSpeed(frame.speed) : '0';
  const rpm = frame ? Math.round(frame.rpm) : 0;
  const gear = frame?.gear ?? 0;
  const gearDisplay = formatGear(gear);
  const isGearFocused = settings.focusMode === 'gear';
  const shiftIndicatorPct = frame?.shift_indicator_pct ?? 0;

  const rpmColors = {
    low: settings.rpmColorLow,
    mid: settings.rpmColorMid,
    high: settings.rpmColorHigh,
    limit: settings.rpmColorLimit,
  };

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

  const currentMax = maxShiftRpmRef.current || initialMax;
  const displayPct = Math.min(Math.max(rpm / currentMax, 0), 1);
  const zoneColor = getShiftZoneColor(displayPct, rpmColors);
  const isLimit = shiftIndicatorPct >= 0.99 || displayPct >= 1;
  const centerValue = isGearFocused ? gearDisplay : speed;

  return (
    <WidgetPanel direction="row" className={styles.altPanel}>
      <div className={styles.statBlock}>
        <div className={styles.value}>{rpm}</div>
        <span className={styles.label} style={{ color: rpmColors.limit }}>
          RPM
        </span>
      </div>

      <GearCircle
        displayPct={displayPct}
        zoneColor={zoneColor}
        isLimit={isLimit}
        centerValue={centerValue}
        rpmLimitColor={rpmColors.limit}
      />

      <div className={styles.statBlock}>
        <div className={styles.value}>
          {isGearFocused ? speed : gearDisplay}
        </div>
        <span className={styles.label} style={{ color: rpmColors.limit }}>
          {isGearFocused ? speedUnit : 'GEAR'}
        </span>
      </div>
    </WidgetPanel>
  );
});
