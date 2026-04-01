import { useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useUnits } from '../../../hooks/useUnits';
import { formatGear } from '../../../utils/telemetry-format';
import { WidgetPanel } from '../primitives/WidgetPanel';
import styles from './SpeedWidgetAlt.module.scss';

const CIRCLE_R = 90;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

function getShiftZoneColor(
  pct: number,
  colors: { low: string; mid: string; high: string; limit: string }
): string {
  if (pct >= 1) return colors.limit;
  if (pct >= 0.7) return colors.high;
  if (pct >= 0.35) return colors.mid;
  return colors.low;
}

export const SpeedWidgetAlt = observer(() => {
  const { frame, driverInfo } = telemetryStore;
  const { formatSpeed, speedUnit } = useUnits();
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

  // Anchor for 100% RPM fill. Start with session info, but refine with shift_indicator_pct.
  const initialMax =
    driverInfo?.DriverCarSLShiftRPM || driverInfo?.DriverCarRedLine || 10000;
  const maxShiftRpmRef = useRef(initialMax);
  const hasRefinedRef = useRef(false);
  const lastDriverInfoRef = useRef(driverInfo);

  // Reset anchor if the car/session changes
  if (lastDriverInfoRef.current !== driverInfo) {
    maxShiftRpmRef.current = initialMax;
    hasRefinedRef.current = false;
    lastDriverInfoRef.current = driverInfo;
  }

  // If we hit the shift point (pct=1), the current RPM is our 100% mark.
  // We refine the anchor once to match the actual car's shift point.
  if (shiftIndicatorPct >= 1 && rpm > 0) {
    if (!hasRefinedRef.current || rpm > maxShiftRpmRef.current) {
      maxShiftRpmRef.current = rpm;
      hasRefinedRef.current = true;
    }
  }

  // The visual fill is linear based on RPM relative to the anchor
  const currentMax = maxShiftRpmRef.current || initialMax;
  const displayPct = Math.min(Math.max(rpm / currentMax, 0), 1);
  const offset = CIRCUMFERENCE - displayPct * CIRCUMFERENCE;
  const zoneColor = getShiftZoneColor(displayPct, rpmColors);

  // Blink when the game says shift OR when we visually hit 100%
  const isLimit = shiftIndicatorPct >= 0.99 || displayPct >= 1;

  const centerValue = isGearFocused ? gearDisplay : speed;
  const centerLabel = isGearFocused ? 'GEAR' : speedUnit;

  return (
    <WidgetPanel
      minWidth={400}
      direction="row"
      gap={32}
      className={styles.altPanel}
    >
      <span className={styles.statBlock}>
        <span className={styles.value}>{rpm}</span>
        <span className={styles.label} style={{ color: rpmColors.limit }}>
          RPM
        </span>
      </span>

      <span className={styles.gearContainer}>
        <svg className={styles.gearSvg} viewBox="0 0 200 200">
          <circle className={styles.circleBg} cx="100" cy="100" r={CIRCLE_R} />

          <circle
            className={`${styles.circleProgress} ${isLimit ? styles.blinkAlert : ''}`}
            cx="100"
            cy="100"
            r={CIRCLE_R}
            style={{
              stroke: zoneColor,
              strokeDashoffset: offset,
              filter: isLimit
                ? `drop-shadow(0 0 15px ${rpmColors.limit})`
                : 'none',
            }}
          />
        </svg>

        <span className={styles.gearValue}>{centerValue}</span>
        <span className={styles.centerLabel} style={{ color: rpmColors.limit }}>
          {centerLabel}
        </span>
      </span>

      <span className={styles.statBlock}>
        <span className={styles.value}>
          {isGearFocused ? speed : gearDisplay}
        </span>
        <span className={styles.label} style={{ color: rpmColors.limit }}>
          {isGearFocused ? speedUnit : 'GEAR'}
        </span>
      </span>
    </WidgetPanel>
  );
});
