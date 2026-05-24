import { observer } from 'mobx-react-lite';

import { resolveSessionLaps } from '@utils/formatters/telemetry-format';
import {
  formatLapCount,
  formatPosition,
  isSessionEnded,
} from '@utils/widget/timer-utils';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { TimerWidgetSettings } from '@/types/widget-settings';

import styles from './TimerFooter.module.scss';

export const TimerFooter = observer(() => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showLaps, showPosition } =
    widgetSettings.getSettings<TimerWidgetSettings>('timer');

  const session = telemetry.session;

  if (!showLaps && !showPosition) {
    return null;
  }

  if (isSessionEnded(session?.session_state ?? null)) {
    return null;
  }

  const sessions = telemetry.sessionInfo?.SessionInfo?.Sessions ?? [];
  const driverInfo = telemetry.driverInfo;
  const carIdx = telemetry.carIdx;

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
          telemetry.leaderBestLapTime
        )
      : null;

  const position = telemetry.lapTiming?.player_car_position ?? null;
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
