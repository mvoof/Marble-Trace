import { observer } from 'mobx-react-lite';

import {
  isSessionEnded,
  resolveSessionClock,
  splitTime,
} from '@utils/timer-utils';

import { useSessionStore } from '@store/root-store-context';
import styles from './TimerDisplay.module.scss';

export const TimerDisplay = observer(() => {
  const { session } = useSessionStore();

  const sessionState = session?.session_state ?? null;

  if (isSessionEnded(sessionState)) {
    return (
      <div className={styles.timeDisplay}>
        <span className={styles.sessionEndedLabel}>END</span>
      </div>
    );
  }

  const { seconds: rawSeconds } = resolveSessionClock(
    session?.session_time_remain ?? null,
    session?.session_time ?? null
  );

  const { main: timeMain, secs: timeSeconds } = splitTime(rawSeconds);

  return (
    <div className={styles.timeDisplay}>
      <span className={styles.timeMain}>{timeMain}</span>

      <span className={styles.timeSeconds}>{timeSeconds}</span>
    </div>
  );
});
