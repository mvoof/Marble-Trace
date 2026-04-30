import type { CSSProperties } from 'react';
import { Droplet, Thermometer } from 'lucide-react';
import type { SpeedWidgetSettings } from '../../../types/widget-settings';
import { formatGear } from '../../../utils/telemetry-format';
import { getShiftZoneColor } from './speed-utils';
import { PitPanel } from './PitPanel/PitPanel';

import styles from './SpeedWidget.module.scss';

const LED_COUNT = 20;

interface SpeedWidgetProps {
  speed: string;
  speedUnit: string;
  rpm: number;
  gear: number;
  maxShiftRpm: number;
  settings: SpeedWidgetSettings;
  isOnPitRoad: boolean;
  pitLimiterActive: boolean;
  pitState: 'pit-lane' | 'limiter-active' | 'over-limit';
  pitLimitFormatted: string;
  pitSpeedDelta: number | null;
  oilTemp: string;
  waterTemp: string;
  tempUnit: string;
  oilTempWarn: boolean;
  waterTempWarn: boolean;
}

export const SpeedWidget = ({
  speed,
  speedUnit,
  rpm,
  gear,
  maxShiftRpm,
  settings,
  isOnPitRoad,
  pitLimiterActive,
  pitState,
  pitLimitFormatted,
  pitSpeedDelta,
  oilTemp,
  waterTemp,
  tempUnit,
  oilTempWarn,
  waterTempWarn,
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
  const litCount = Math.floor(displayPct * LED_COUNT);

  const showPitPanel =
    settings.showPitPanel && (isOnPitRoad || pitLimiterActive);

  // focusMode controls which value is large (primary) vs small (secondary)
  const primaryValue = isGearFocused ? gearDisplay : speed;
  const primaryLabel = isGearFocused ? 'GEAR' : speedUnit;
  const secondaryValue = isGearFocused ? speed : gearDisplay;
  const secondaryLabel = isGearFocused ? speedUnit : 'GEAR';

  return (
    <div className={styles.root}>
      {showPitPanel && (
        <PitPanel
          pitState={pitState}
          limitSpeed={pitLimitFormatted}
          speedUnit={speedUnit}
          speedDelta={pitSpeedDelta}
        />
      )}

      <div className={styles.mainDisplay}>
        <div className={styles.leftBlock}>
          <div className={styles.leftInner}>
            <span className={styles.secondaryValue}>{secondaryValue}</span>
            <span className={styles.secondaryLabel}>{secondaryLabel}</span>
          </div>
        </div>

        <div className={styles.rightBlock}>
          <div className={styles.rightInner}>
            <div className={styles.primaryGroup}>
              <span className={styles.primaryValue}>{primaryValue}</span>
              <span className={styles.primaryLabel}>{primaryLabel}</span>
            </div>

            {settings.showTemps && (
              <div className={styles.tempsGroup}>
                <div className={styles.tempRow}>
                  <Droplet
                    className={`${styles.tempIcon} ${oilTempWarn ? styles.tempIconWarn : ''}`}
                  />
                  <span
                    className={`${styles.tempValue} ${oilTempWarn ? styles.tempValueWarn : ''}`}
                  >
                    {oilTemp}
                  </span>
                  <span className={styles.tempUnit}>{tempUnit}</span>
                </div>
                <div className={styles.tempRow}>
                  <Thermometer
                    className={`${styles.tempIcon} ${waterTempWarn ? styles.tempIconWarn : ''}`}
                  />
                  <span
                    className={`${styles.tempValue} ${waterTempWarn ? styles.tempValueWarn : ''}`}
                  >
                    {waterTemp}
                  </span>
                  <span className={styles.tempUnit}>{tempUnit}</span>
                </div>
              </div>
            )}

            <div className={styles.rpmGroup}>
              <span className={styles.rpmValue}>{rpm}</span>
              <span className={styles.rpmLabel}>RPM</span>
            </div>
          </div>
        </div>
      </div>

      {settings.showRpmBar && (
        <div
          className={`${styles.rpmBar} ${displayPct >= 1 ? styles.rpmBarBlink : ''}`}
          style={
            displayPct >= 1
              ? ({ '--blink-color': rpmColors.limit } as CSSProperties)
              : undefined
          }
        >
          {Array.from({ length: LED_COUNT }, (_, i) => {
            const segPct = (i + 1) / LED_COUNT;
            const color =
              displayPct >= 1
                ? rpmColors.limit
                : i < litCount
                  ? getShiftZoneColor(segPct, rpmColors)
                  : undefined;
            return (
              <div
                key={i}
                className={styles.rpmSeg}
                style={
                  color
                    ? { background: color, boxShadow: `0 0 3px ${color}` }
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
