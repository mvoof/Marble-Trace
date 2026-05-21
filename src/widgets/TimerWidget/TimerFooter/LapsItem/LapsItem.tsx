import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { resolveSessionLaps } from '@utils/formatters/telemetry-format';
import { formatLapCount } from '@utils/widget/timer-utils';

import styles from './LapsItem.module.scss';

export const LapsItem = observer(() => {
  const { showLaps } = widgetSettingsStore.getTimerSettings();

  if (!showLaps) {
    return null;
  }

  const session = telemetryStore.session;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];
  const driverInfo = telemetryStore.driverInfo;
  const carIdx = telemetryStore.carIdx;

  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;
  const remain = session?.session_time_remain ?? null;

  const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;

  const totalLaps =
    sessionNum !== null
      ? resolveSessionLaps(
          currentSession?.SessionLaps,
          remain,
          currentLap,
          telemetryStore.leaderBestLapTime
        )
      : null;

  return (
    <span className={styles.footerItem}>
      {formatLapCount(currentLap, totalLaps)}
    </span>
  );
});
