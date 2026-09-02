import { observer } from 'mobx-react-lite';

import {
  isLapLimitedSession,
  isSessionEnded,
  resolveSessionClock,
  splitTime,
} from '@utils/timer-utils';

import { useSessionStore } from '@store/root-store-context';
import { FixedDigits } from '../FixedDigits/FixedDigits';
import styles from './TimerDisplay.module.scss';

export const TimerDisplay = observer(() => {
  const { session, sessionInfo } = useSessionStore();

  const sessionState = session?.session_state ?? null;

  if (isSessionEnded(sessionState)) {
    return (
      <div className={styles.timeDisplay}>
        <span className={styles.sessionEndedLabel}>END</span>
      </div>
    );
  }

  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessionInfo?.sessions?.[sessionNum] ?? null) : null;

  const { seconds: rawSeconds } = resolveSessionClock(
    session?.session_time_remain ?? null,
    session?.session_time ?? null,
    isLapLimitedSession(currentSession?.sessionLaps)
  );

  const { main: timeMain, secs: timeSeconds } = splitTime(rawSeconds);

  return (
    <div className={styles.timeDisplay}>
      <FixedDigits className={styles.timeMain} text={timeMain} />

      <FixedDigits className={styles.timeSeconds} text={timeSeconds} />
    </div>
  );
});
