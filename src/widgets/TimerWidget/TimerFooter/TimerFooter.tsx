import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { resolveSessionLaps } from '../../../utils/formatters/telemetry-format';
import {
  formatLapCount,
  formatPosition,
  isSessionEnded,
} from '../../../utils/widget/timer-utils';

import styles from './TimerFooter.module.scss';

export const TimerFooter = observer(() => {
  const session = telemetryStore.session;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];
  const driverInfo = telemetryStore.driverInfo;
  const carIdx = telemetryStore.carIdx;
  const lap = telemetryStore.lapTiming;
  const { showLaps, showPosition } = widgetSettingsStore.getTimerSettings();

  if (isSessionEnded(session?.session_state ?? null)) {
    return null;
  }

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

  const position = lap?.player_car_position ?? null;
  const totalDrivers = driverInfo?.Drivers?.length ?? null;

  return (
    <div className={styles.footer}>
      {showLaps && (
        <span className={styles.footerItem}>
          {formatLapCount(currentLap, totalLaps)}
        </span>
      )}

      {showPosition && (
        <span className={styles.footerItem}>
          {formatPosition(position, totalDrivers)}
        </span>
      )}
    </div>
  );
});
