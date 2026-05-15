import React from 'react';
import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { getShiftZoneColor } from '../speed-utils';
import type { RpmColors } from '../RpmBar/RpmBar';
import styles from './RpmPanel.module.scss';

const RPM_COLOR_OFF = 'rgba(255,255,255,0.55)';

interface RpmPanelProps {
  shiftRpm: number;
  blinkRpm: number;
  colors: RpmColors;
  showRpmColor: boolean;
}

export const RpmPanel = observer(
  ({ shiftRpm, blinkRpm, colors, showRpmColor }: RpmPanelProps) => {
    const rpm = Math.round(telemetryStore.carDynamics?.rpm ?? 0);

    const isBlink = rpm >= blinkRpm;
    const isShift = rpm >= shiftRpm;
    const pct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);

    const colorHex = showRpmColor
      ? isBlink
        ? colors.limit
        : isShift
          ? colors.shift
          : getShiftZoneColor(pct, colors)
      : RPM_COLOR_OFF;

    return (
      <span
        className={styles.rpmValue}
        style={{ '--rpm-color': colorHex } as React.CSSProperties}
      >
        {rpm}
      </span>
    );
  }
);
