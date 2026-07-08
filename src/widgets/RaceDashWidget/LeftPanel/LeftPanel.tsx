import { observer } from 'mobx-react-lite';

import { resolveSessionLaps } from '@utils/formatters/telemetry-format';
import { PitBlock } from '../PitBlock/PitBlock';
import { RpmValue } from '../RpmValue/RpmValue';
import {
  useCarsStore,
  usePlayerStore,
  useSessionStore,
} from '@store/root-store-context';

import styles from './LeftPanel.module.scss';

interface LeftPanelProps {
  isPitMode: boolean;
}

export const LeftPanel = observer(({ isPitMode }: LeftPanelProps) => {
  const player = usePlayerStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();

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

  const lapText =
    currentLap != null
      ? isUnlimited
        ? `${currentLap}`
        : `${currentLap}/${totalLapsStr}`
      : '—';

  return (
    <div className={styles.root}>
      <div className={`${styles.layer} ${isPitMode ? styles.hidden : ''}`}>
        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.label}>RPM</span>
            <RpmValue />
          </div>

          <div className={styles.row}>
            <span className={styles.label}>LAP</span>
            <span className={styles.value}>{lapText}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>POS</span>
            <span className={styles.value}>
              {position != null ? `P${position}` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className={`${styles.layer} ${!isPitMode ? styles.hidden : ''}`}>
        {isPitMode && <PitBlock />}
      </div>
    </div>
  );
});
