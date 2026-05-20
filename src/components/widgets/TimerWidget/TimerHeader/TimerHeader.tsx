import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { FLAG_LABEL, resolveFlagState, type FlagState } from '../timer-utils';

import styles from './TimerHeader.module.scss';

const FLAG_CLASS: Record<FlagState, string> = {
  green: styles.flagGreen,
  final: styles.flagFinal,
  checkered: styles.flagCheckered,
};

export const TimerHeader = observer(() => {
  const session = telemetryStore.session;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];
  const { showFlag } = widgetSettingsStore.getTimerSettings();

  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;
  const sessionTypeLabel =
    currentSession?.SessionType?.toUpperCase() ?? 'SESSION';

  const remain = session?.session_time_remain ?? null;
  const flagState = resolveFlagState(session?.session_flags ?? null, remain);

  return (
    <div className={styles.header}>
      <span className={styles.sessionLabel}>{sessionTypeLabel}</span>

      {showFlag && (
        <span className={`${styles.flagLabel} ${FLAG_CLASS[flagState]}`}>
          ● {FLAG_LABEL[flagState]}
        </span>
      )}
    </div>
  );
});
