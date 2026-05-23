import { observer } from 'mobx-react-lite';

import { TimerFlagBadge } from './TimerFlagBadge/TimerFlagBadge';
import styles from './TimerHeader.module.scss';
import { useTelemetryStore } from '@store/root-store-context';

export const TimerHeader = observer(() => {
  const telemetry = useTelemetryStore();

  const session = telemetry.session;
  const sessions = telemetry.sessionInfo?.SessionInfo?.Sessions ?? [];

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
