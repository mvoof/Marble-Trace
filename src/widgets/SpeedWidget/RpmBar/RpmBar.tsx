import React from 'react';
import { observer } from 'mobx-react-lite';
import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { useShiftThresholds } from '@hooks/widget/useShiftThresholds';
import { getShiftZoneColor } from '@utils/widget/speed-utils';
import styles from './RpmBar.module.scss';

const LED_COUNT = 22;

export interface RpmColors {
  low: string;
  mid: string;
  high: string;
  shift: string;
  limit: string;
}

export const RpmBar = observer(() => {
  const {
    rpmColorLow,
    rpmColorMid,
    rpmColorHigh,
    rpmColorShift,
    rpmColorLimit,
    ledShape,
    showRpmBar,
  } = widgetSettingsStore.getSpeedSettings();

  if (!showRpmBar) {
    return null;
  }
  const colors: RpmColors = {
    low: rpmColorLow,
    mid: rpmColorMid,
    high: rpmColorHigh,
    shift: rpmColorShift,
    limit: rpmColorLimit,
  };
  const rpm = telemetryStore.carDynamics?.rpm ?? 0;
  const { shiftRpm, blinkRpm } = useShiftThresholds();

  const isShift = rpm >= shiftRpm;
  const isBlink = rpm >= blinkRpm;

  const displayPct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);
  const litCount = Math.floor(displayPct * LED_COUNT);

  const isCircle = ledShape === 'circle';

  return (
    <div className={`${styles.rpmBar} ${isBlink ? styles.rpmBarBlink : ''}`}>
      {Array.from({ length: LED_COUNT }, (_, index) => {
        const isLit = index < litCount;

        if (!isLit) {
          return (
            <div
              key={`led-${index}`}
              className={styles.rpmSeg}
              style={{
                borderRadius: isCircle ? '50%' : '15%',
              }}
            />
          );
        }

        const color = isBlink
          ? colors.limit
          : isShift
            ? colors.shift
            : getShiftZoneColor((index + 1) / LED_COUNT, colors);

        return (
          <div
            key={`led-${index}`}
            className={`${styles.rpmSeg} ${styles.rpmSegLit}`}
            style={
              {
                '--rpm-seg-color': color,
                borderRadius: isCircle ? '50%' : '15%',
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
});
