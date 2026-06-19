import { observer } from 'mobx-react-lite';

import {
  resolveSessionColorKey,
  type SessionColorKey,
} from '@utils/widget/timer-utils';
import { useSessionStore } from '@store/root-store-context';
import styles from './TimerHeader.module.scss';

const SESSION_LABEL_CLASS: Record<SessionColorKey, string> = {
  practice: styles.sessionPractice,
  qualify: styles.sessionQualify,
  race: styles.sessionRace,
  other: styles.sessionOther,
};

export const TimerHeader = observer(() => {
  const { session, sessionInfo } = useSessionStore();

  const sessions = sessionInfo?.sessions ?? [];
  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;
  const sessionType = currentSession?.sessionType ?? 'Unknown';
  const colorKey = resolveSessionColorKey(sessionType);
  const sessionTypeLabel =
    currentSession?.sessionTypeLabel.toUpperCase() ?? 'NO SESSION';

  return (
    <div className={`${styles.header} ${SESSION_LABEL_CLASS[colorKey]}`}>
      <span className={styles.sessionLabel}>{sessionTypeLabel}</span>
    </div>
  );
});
