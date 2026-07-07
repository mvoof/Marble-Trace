import { observer } from 'mobx-react-lite';

import { resolveSessionLaps } from '@utils/formatters/telemetry-format';

import styles from './InfoColumn.module.scss';
import {
  useCarsStore,
  usePlayerStore,
  useSessionStore,
} from '@store/root-store-context';

export const InfoColumn = observer(() => {
  const player = usePlayerStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();

  const rpm = Math.round(player.carDynamics?.rpm ?? 0);

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
        <span className={styles.value}>{rpm}</span>
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
