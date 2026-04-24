import { WidgetPanel } from '../primitives/WidgetPanel';
import type { SpeedWidgetSettings } from '../../../types/widget-settings';
import { formatGear } from '../../../utils/telemetry-format';
import { GearCircle } from './GearCircle/GearCircle';
import { getShiftZoneColor } from './speed-utils';

import styles from './SpeedWidget.module.scss';

interface SpeedWidgetProps {
  speed: string;
  speedUnit: string;
  rpm: number;
  gear: number;
  shiftIndicatorPct: number;
  maxShiftRpm: number;
  settings: SpeedWidgetSettings;
}

export const SpeedWidget = ({
  speed,
  speedUnit,
  rpm,
  gear,
  shiftIndicatorPct,
  maxShiftRpm,
  settings,
}: SpeedWidgetProps) => {
  const gearDisplay = formatGear(gear);
  const isGearFocused = settings.focusMode === 'gear';

  const rpmColors = {
    low: settings.rpmColorLow,
    mid: settings.rpmColorMid,
    high: settings.rpmColorHigh,
    limit: settings.rpmColorLimit,
  };

  const displayPct = Math.min(Math.max(rpm / (maxShiftRpm || 1), 0), 1);
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
};
