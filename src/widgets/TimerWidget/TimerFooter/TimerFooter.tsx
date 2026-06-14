import { observer } from 'mobx-react-lite';

import { resolveSessionLaps } from '@utils/formatters/telemetry-format';
import {
  formatLapCount,
  formatPosition,
  isSessionEnded,
} from '@utils/widget/timer-utils';
import {
  useCarsStore,
  usePlayerStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { TimerWidgetSettings } from '@/types/widget-settings';

import styles from './TimerFooter.module.scss';

export const TimerFooter = observer(() => {
  const { session, sessionInfo } = useSessionStore();
  const { carIdx, leaderBestLapTime } = useCarsStore();
  const { lapTiming } = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showLaps, showPosition } =
    widgetSettings.getSettings<TimerWidgetSettings>('timer');

  if (!showLaps && !showPosition) {
    return null;
  }

  if (isSessionEnded(session?.session_state ?? null)) {
    return null;
  }

  const sessions = sessionInfo?.sessions ?? [];

  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;
  const remain = session?.session_time_remain ?? null;
  const playerCarIdx = sessionInfo?.playerCarIdx ?? null;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;
  const totalLaps =
    sessionNum !== null
      ? resolveSessionLaps(
          currentSession?.sessionLaps,
          remain,
          currentLap,
          leaderBestLapTime
        )
      : null;

  const position = lapTiming?.player_car_position ?? null;
  const totalDrivers = sessionInfo?.cars.length || null;

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
