import React from 'react';
import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { getShiftZoneColor } from '../speed-utils';
import styles from './RpmBar.module.scss';

const LED_COUNT = 20;

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
}

export const RpmBar = observer(
  ({ shiftRpm, blinkRpm, colors }: RpmBarProps) => {
    const rpm = telemetryStore.carDynamics?.rpm ?? 0;

    const isShift = rpm >= shiftRpm;
    const isBlink = rpm >= blinkRpm;

    const displayPct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);
    const litCount = Math.floor(displayPct * LED_COUNT);

    return (
      <div className={`${styles.rpmBar} ${isBlink ? styles.rpmBarBlink : ''}`}>
        {Array.from({ length: LED_COUNT }, (_, i) => {
          const isLit = i < litCount;

          if (!isLit) {
            return <div key={`led-${i}`} className={styles.rpmSeg} />;
          }

          const color = isBlink
            ? colors.limit
            : isShift
              ? colors.shift
              : getShiftZoneColor((i + 1) / LED_COUNT, colors);

          return (
            <div
              key={`led-${i}`}
              className={`${styles.rpmSeg} ${styles.rpmSegLit}`}
              style={{ '--rpm-seg-color': color } as React.CSSProperties}
            />
          );
        })}
      </div>
    );
  }
);
