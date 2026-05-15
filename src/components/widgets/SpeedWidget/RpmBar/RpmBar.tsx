import React from 'react';
import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { getShiftZoneColor } from '../speed-utils';
import type { LedShape } from '../../../../types/widget-settings';
import styles from './RpmBar.module.scss';

const LED_COUNT = 24;

export interface RpmColors {
  low: string;
  mid: string;
  high: string;
  shift: string;
  limit: string;
}

interface RpmBarProps {
  shiftRpm: number;
  blinkRpm: number;
  colors: RpmColors;
  ledShape: LedShape;
}

export const RpmBar = observer(
  ({ shiftRpm, blinkRpm, colors, ledShape }: RpmBarProps) => {
    const rpm = telemetryStore.carDynamics?.rpm ?? 0;

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
                  transform: isCircle ? 'scale(0.85)' : 'none',
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
                  transform: isCircle ? 'scale(0.85)' : 'none',
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
    );
  }
);
