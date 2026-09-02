import { observer } from 'mobx-react-lite';
import { Timer } from 'lucide-react';

import {
  isLapLimitedSession,
  isSessionEnded,
  resolveClockUrgency,
  resolveSessionClock,
  splitTime,
  type ClockUrgency,
} from '@utils/timer-utils';
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

// Matches the icons the rest of the header carries.
const ICON_SIZE_PX = 11;

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
    return (
      <span className={styles.clock}>
        <Timer size={ICON_SIZE_PX} className={styles.clockIcon} />
        END
      </span>
    );
  }

  const remain = session?.session_time_remain ?? null;

  const currentSession =
    sessionInfo?.sessions?.[sessionInfo?.currentSessionNum ?? 0];

  // In a lap race the clock is context, not the thing that ends the session.
  const isLapLimited = isLapLimitedSession(currentSession?.sessionLaps);

  const { seconds: rawSeconds, isCountdown } = resolveSessionClock(
    remain,
    session?.session_time ?? null,
    isLapLimited
  );

  const urgency = isCountdown ? resolveClockUrgency(remain) : 'normal';

  const { main, secs } = splitTime(rawSeconds);

  const isLead = !isLapLimited;

  // A session past its clock counts up — the "+" is what tells the two apart
  // now that neither carries an icon.
  const prefix = isCountdown ? '' : '+';

  return (
    <span
      className={`${styles.clock} ${isLead ? '' : styles.clockMuted} ${URGENCY_CLASS[urgency]}`}
    >
      <Timer size={ICON_SIZE_PX} className={styles.clockIcon} />

      <span
        className={styles.clockValue}
        style={{ minWidth: `${CLOCK_WIDTH_CHARS}ch` }}
      >
        {`${prefix}${main}${secs}`}
      </span>
    </span>
  );
});
