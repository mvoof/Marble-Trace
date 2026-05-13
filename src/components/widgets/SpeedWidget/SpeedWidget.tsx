import { useImperativeHandle, useMemo, useRef } from 'react';
import type { Ref } from 'react';
import { Droplet, Thermometer } from 'lucide-react';
import type { SpeedWidgetSettings } from '../../../types/widget-settings';
import { formatGear } from '../../../utils/telemetry-format';
import {
  PitPanel,
  type PitPanelHandle,
  type PitState,
} from './PitPanel/PitPanel';
import { RpmBar, type RpmBarHandle } from './RpmBar/RpmBar';

import styles from './SpeedWidget.module.scss';

export interface SpeedDisplayHandle {
  update: (
    speed: string,
    rpm: number,
    gear: number,
    pitState: PitState,
    pitSpeedDelta: number | null
  ) => void;
}

interface SpeedWidgetProps {
  initialSpeed: string;
  initialRpm: number;
  initialGear: number;
  speedUnit: string;
  shiftRpm: number;
  blinkRpm: number;
  settings: SpeedWidgetSettings;
  isOnPitRoad: boolean;
  pitLimiterActive: boolean;
  initialPitState: PitState;
  pitLimitFormatted: string;
  initialPitSpeedDelta: number | null;
  oilTemp: string;
  waterTemp: string;
  tempUnit: string;
  oilTempWarn: boolean;
  waterTempWarn: boolean;
  ref?: Ref<SpeedDisplayHandle>;
}

export const SpeedWidget = ({
  initialSpeed,
  initialRpm,
  initialGear,
  speedUnit,
  shiftRpm,
  blinkRpm,
  settings,
  isOnPitRoad,
  pitLimiterActive,
  initialPitState,
  pitLimitFormatted,
  initialPitSpeedDelta,
  oilTemp,
  waterTemp,
  tempUnit,
  oilTempWarn,
  waterTempWarn,
  ref,
}: SpeedWidgetProps) => {
  const isGearFocused = settings.focusMode === 'gear';

  const primaryRef = useRef<HTMLSpanElement>(null);
  const secondaryRef = useRef<HTMLSpanElement>(null);
  const rpmValueRef = useRef<HTMLSpanElement>(null);
  const rpmBarRef = useRef<RpmBarHandle>(null);
  const pitPanelRef = useRef<PitPanelHandle>(null);

  const rpmColors = useMemo(
    () => ({
      low: settings.rpmColorLow,
      mid: settings.rpmColorMid,
      high: settings.rpmColorHigh,
      shift: settings.rpmColorShift,
      limit: settings.rpmColorLimit,
    }),
    [
      settings.rpmColorLow,
      settings.rpmColorMid,
      settings.rpmColorHigh,
      settings.rpmColorShift,
      settings.rpmColorLimit,
    ]
  );

  const showPitPanel =
    settings.showPitPanel && (isOnPitRoad || pitLimiterActive);

  const initialPrimary = isGearFocused ? formatGear(initialGear) : initialSpeed;
  const initialSecondary = isGearFocused
    ? initialSpeed
    : formatGear(initialGear);

  useImperativeHandle(
    ref,
    () => ({
      update: (speed, rpm, gear, pitState, pitSpeedDelta) => {
        const primary = isGearFocused ? formatGear(gear) : speed;
        const secondary = isGearFocused ? speed : formatGear(gear);

        if (primaryRef.current) primaryRef.current.textContent = primary;
        if (secondaryRef.current) secondaryRef.current.textContent = secondary;
        if (rpmValueRef.current) rpmValueRef.current.textContent = String(rpm);

        if (settings.showRpmBar) rpmBarRef.current?.update(rpm);

        pitPanelRef.current?.update(pitState, pitSpeedDelta);
      },
    }),
    [isGearFocused, settings.showRpmBar]
  );

  const primaryLabel = isGearFocused ? 'GEAR' : speedUnit;
  const secondaryLabel = isGearFocused ? speedUnit : 'GEAR';

  return (
    <div className={styles.root}>
      {showPitPanel && (
        <PitPanel
          ref={pitPanelRef}
          initialState={initialPitState}
          limitSpeed={pitLimitFormatted}
          speedUnit={speedUnit}
          initialDelta={initialPitSpeedDelta}
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
        <RpmBar
          ref={rpmBarRef}
          shiftRpm={shiftRpm}
          blinkRpm={blinkRpm}
          colors={rpmColors}
        />
      )}
    </div>
  );
};
