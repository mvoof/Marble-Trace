import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Droplet, Thermometer } from 'lucide-react';
import type { SpeedWidgetSettings } from '../../../types/widget-settings';
import { formatGear } from '../../../utils/telemetry-format';
import { getShiftZoneColor } from './speed-utils';
import { PitPanel } from './PitPanel/PitPanel';

import styles from './SpeedWidget.module.scss';

const LED_COUNT = 20;

export interface SpeedDisplayHandle {
  update: (
    speed: string,
    rpm: number,
    gear: number,
    shiftIndicatorPct: number
  ) => void;
}

interface SpeedWidgetProps {
  initialSpeed: string;
  initialRpm: number;
  initialGear: number;
  speedUnit: string;
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

export const SpeedWidget = forwardRef<SpeedDisplayHandle, SpeedWidgetProps>(
  (
    {
      initialSpeed,
      initialRpm,
      initialGear,
      speedUnit,
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
    },
    ref
  ) => {
    const isGearFocused = settings.focusMode === 'gear';

    const primaryRef = useRef<HTMLSpanElement>(null);
    const secondaryRef = useRef<HTMLSpanElement>(null);
    const rpmValueRef = useRef<HTMLSpanElement>(null);
    const rpmBarRef = useRef<HTMLDivElement>(null);

    const rpmColors = useMemo(
      () => ({
        low: settings.rpmColorLow,
        mid: settings.rpmColorMid,
        high: settings.rpmColorHigh,
        limit: settings.rpmColorLimit,
      }),
      [
        settings.rpmColorLow,
        settings.rpmColorMid,
        settings.rpmColorHigh,
        settings.rpmColorLimit,
      ]
    );

    const showPitPanel =
      settings.showPitPanel && (isOnPitRoad || pitLimiterActive);

    const initialPrimary = isGearFocused
      ? formatGear(initialGear)
      : initialSpeed;
    const initialSecondary = isGearFocused
      ? initialSpeed
      : formatGear(initialGear);

    useImperativeHandle(
      ref,
      () => ({
        update: (speed, rpm, gear, shiftIndicatorPct) => {
          const primary = isGearFocused ? formatGear(gear) : speed;
          const secondary = isGearFocused ? speed : formatGear(gear);

          if (primaryRef.current) primaryRef.current.textContent = primary;
          if (secondaryRef.current)
            secondaryRef.current.textContent = secondary;
          if (rpmValueRef.current)
            rpmValueRef.current.textContent = String(rpm);

          if (rpmBarRef.current && settings.showRpmBar) {
            const displayPct = Math.min(
              Math.max(rpm / (maxShiftRpm || 1), 0),
              1
            );
            const litCount = Math.floor(displayPct * LED_COUNT);
            const isLimit = displayPct >= 1;
            const children = rpmBarRef.current.children;

            rpmBarRef.current.classList.toggle(styles.rpmBarBlink, isLimit);

            for (let i = 0; i < children.length; i++) {
              const el = children[i] as HTMLElement;
              if (i < litCount) {
                const color = isLimit
                  ? rpmColors.limit
                  : getShiftZoneColor((i + 1) / LED_COUNT, rpmColors);
                el.style.setProperty('--rpm-seg-color', color);
                el.classList.add(styles.rpmSegLit);
              } else {
                el.classList.remove(styles.rpmSegLit);
              }
            }
          }

          if (
            rpmBarRef.current &&
            shiftIndicatorPct >= 1 &&
            rpm > 0 &&
            !pitLimiterActive &&
            !isOnPitRoad
          ) {
            // maxShiftRpm refinement happens in container
          }
        },
      }),
      [
        isGearFocused,
        settings.showRpmBar,
        pitLimiterActive,
        isOnPitRoad,
        maxShiftRpm,
        rpmColors,
      ]
    );

    const primaryLabel = isGearFocused ? 'GEAR' : speedUnit;
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
              <span ref={secondaryRef} className={styles.secondaryValue}>
                {initialSecondary}
              </span>
              <span className={styles.secondaryLabel}>{secondaryLabel}</span>
            </div>
          </div>

          <div className={styles.rightBlock}>
            <div className={styles.rightInner}>
              <div className={styles.primaryGroup}>
                <span ref={primaryRef} className={styles.primaryValue}>
                  {initialPrimary}
                </span>
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
                <span ref={rpmValueRef} className={styles.rpmValue}>
                  {initialRpm}
                </span>
                <span className={styles.rpmLabel}>RPM</span>
              </div>
            </div>
          </div>
        </div>

        {settings.showRpmBar && (
          <div ref={rpmBarRef} className={styles.rpmBar}>
            {Array.from({ length: LED_COUNT }, (_, i) => (
              <div key={i} className={styles.rpmSeg} />
            ))}
          </div>
        )}
      </div>
    );
  }
);

SpeedWidget.displayName = 'SpeedWidget';
