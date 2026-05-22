import React from 'react';
import { observer } from 'mobx-react-lite';
import { computeShiftThresholds } from '@utils/widget/shift-thresholds';
import { getShiftZoneColor } from '@utils/widget/speed-utils';
import styles from './RpmPanel.module.scss';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const RPM_COLOR_OFF = 'rgba(255,255,255,0.55)';

export const RpmPanel = observer(() => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const {
    rpmColorLow,
    rpmColorMid,
    rpmColorHigh,
    rpmColorShift,
    rpmColorLimit,
    showRpmColor,
  } = widgetSettings.getSpeedSettings();
  const colors = {
    low: rpmColorLow,
    mid: rpmColorMid,
    high: rpmColorHigh,
    shift: rpmColorShift,
    limit: rpmColorLimit,
  };
  const rpm = Math.round(telemetry.carDynamics?.rpm ?? 0);
  const { shiftRpm, blinkRpm } = computeShiftThresholds(telemetry);

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
});
