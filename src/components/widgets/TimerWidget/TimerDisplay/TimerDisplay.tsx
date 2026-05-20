import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { isSessionEnded, splitTime } from '../timer-utils';

import styles from './TimerDisplay.module.scss';

export const TimerDisplay = observer(() => {
  const session = telemetryStore.session;
  const sessionState = session?.session_state ?? null;

  if (isSessionEnded(sessionState)) {
    return (
      <div className={styles.timeDisplay}>
        <span className={styles.sessionEndedLabel}>END</span>
      </div>
    );
  }

  const remain = session?.session_time_remain ?? null;
  const elapsed = session?.session_time ?? null;
  const isCountdown = remain !== null && remain >= 0;
  const rawSeconds = isCountdown ? (remain ?? 0) : (elapsed ?? 0);
  const { main: timeMain, secs: timeSeconds } = splitTime(rawSeconds);

  return (
    <div className={styles.timeDisplay}>
      <span className={styles.timeMain}>{timeMain}</span>
      <span className={styles.timeSeconds}>{timeSeconds}</span>
    </div>
  );
});
