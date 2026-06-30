import React from 'react';
import { observer } from 'mobx-react-lite';

import type { SpeedWidgetSettings } from '@/types/widget-settings';
import { resolveSessionLaps } from '@utils/formatters/telemetry-format';
import { computeShiftThresholds } from '@utils/widget/shift-thresholds';
import { getShiftZoneColor } from '@utils/widget/speed-utils';

import styles from './InfoColumn.module.scss';
import {
  useCarsStore,
  usePlayerStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const RPM_COLOR_OFF = 'rgba(255,255,255,0.55)';

export const InfoColumn = observer(() => {
  const player = usePlayerStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();
  const widgetSettings = useWidgetSettingsStore();

  const {
    rpmColorLow,
    rpmColorMid,
    rpmColorHigh,
    rpmColorShift,
    rpmColorLimit,
    showRpmColor,
  } = widgetSettings.getSettings<SpeedWidgetSettings>('speed');

  const rpm = Math.round(player.carDynamics?.rpm ?? 0);
  const { shiftRpm, blinkRpm } = computeShiftThresholds(
    sessionInfo,
    player.carStatus
  );
  const isBlink = rpm >= blinkRpm;
  const isShift = rpm >= shiftRpm;
  const pct = Math.min(Math.max(rpm / (blinkRpm || 1), 0), 1);
  const colors = {
    low: rpmColorLow,
    mid: rpmColorMid,
    high: rpmColorHigh,
    shift: rpmColorShift,
    limit: rpmColorLimit,
  };
  const rpmColor = showRpmColor
    ? isBlink
      ? colors.limit
      : isShift
        ? colors.shift
        : getShiftZoneColor(pct, colors)
    : RPM_COLOR_OFF;

  const currentLap = player.lapTiming?.lap;
  const position = player.lapTiming?.player_car_position;

  const sessions = sessionInfo?.sessions;
  const currentSession = sessions?.[sessionInfo?.currentSessionNum ?? 0];
  const totalLapsStr = currentSession?.sessionLaps
    ? resolveSessionLaps(
        currentSession.sessionLaps,
        session?.session_time_remain ?? null,
        currentLap ?? null,
        leaderBestLapTime
      )
    : null;
  const isUnlimited =
    !totalLapsStr || totalLapsStr.toLowerCase() === 'unlimited';

  return (
    <div className={styles.column}>
      <div className={styles.row}>
        <span className={styles.label}>RPM</span>
        <span
          className={styles.rpmValue}
          style={
            {
              '--rpm-color': rpmColor,
            } as React.CSSProperties
          }
        >
          {rpm}
        </span>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>LAP</span>
        <span className={styles.value}>
          {currentLap != null
            ? isUnlimited
              ? currentLap
              : `${currentLap}/${totalLapsStr}`
            : '—'}
        </span>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>POS</span>
        <span className={styles.value}>
          {position != null ? `P${position}` : '—'}
        </span>
      </div>
    </div>
  );
});
