import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';

import { TimerFlagBadge } from './TimerFlagBadge/TimerFlagBadge';
import styles from './TimerHeader.module.scss';

export const TimerHeader = observer(() => {
  const session = telemetryStore.session;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];

  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;
  const sessionTypeLabel =
    currentSession?.SessionType?.toUpperCase() ?? 'SESSION';

  return (
    <div className={styles.header}>
      <span className={styles.sessionLabel}>{sessionTypeLabel}</span>

      <TimerFlagBadge />
    </div>
  );
});
