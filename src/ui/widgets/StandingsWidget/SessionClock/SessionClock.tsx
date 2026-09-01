import { observer } from 'mobx-react-lite';

import {
  isSessionEnded,
  resolveClockUrgency,
  resolveSessionClock,
  splitTime,
  type ClockUrgency,
} from '@utils/timer-utils';
import { isLapLimitedSession } from '@ui/widgets/StandingsWidget/standings-utils';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import {
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './SessionClock.module.scss';

const URGENCY_CLASS: Record<ClockUrgency, string> = {
  normal: '',
  warning: styles.clockWarning,
  critical: styles.clockCritical,
};

// +hh:mm:ss — the widest the clock gets, so the header does not shift when a
// countdown runs out and the elapsed time takes over.
const CLOCK_WIDTH_CHARS = 9;

export const SessionClock = observer(() => {
  const { session, sessionInfo } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!settings.showSessionTime) {
    return null;
  }

  const sessionState = session?.session_state ?? null;

  if (isSessionEnded(sessionState)) {
    return <span className={styles.clock}>END</span>;
  }

  const remain = session?.session_time_remain ?? null;

  const { seconds: rawSeconds, isCountdown } = resolveSessionClock(
    remain,
    session?.session_time ?? null
  );

  const urgency = isCountdown ? resolveClockUrgency(remain) : 'normal';

  const { main, secs } = splitTime(rawSeconds);

  const currentSession =
    sessionInfo?.sessions?.[sessionInfo?.currentSessionNum ?? 0];

  // In a lap race the clock is context, not the thing that ends the session.
  const isLead = !isLapLimitedSession(currentSession?.sessionLaps);

  // A session past its clock counts up — the "+" is what tells the two apart
  // now that neither carries an icon.
  const prefix = isCountdown ? '' : '+';

  return (
    <span
      className={`${styles.clock} ${isLead ? styles.clockLead : styles.clockMuted} ${URGENCY_CLASS[urgency]}`}
      style={{ minWidth: `${CLOCK_WIDTH_CHARS}ch` }}
    >
      {`${prefix}${main}${secs}`}
    </span>
  );
});
