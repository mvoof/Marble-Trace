import { observer } from 'mobx-react-lite';

import { TimerFlagBadge } from './TimerFlagBadge/TimerFlagBadge';
import { useTelemetryStore } from '@store/root-store-context';
import styles from './TimerHeader.module.scss';
import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';

export const TimerHeader = observer(() => {
  const { session, sessionInfo } = useTelemetryStore();

  const sessions = sessionInfo?.SessionInfo?.Sessions ?? [];

  const sessionNum = session?.session_num ?? null;

  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;

  const sessionTypeLabel =
    currentSession?.SessionType?.toUpperCase() ?? 'NO SESSION';

  return (
    <div className={styles.header}>
      <WidgetLabel className={styles.sessionLabel}>
        {sessionTypeLabel}
      </WidgetLabel>

      <TimerFlagBadge />
    </div>
  );
});
