import { observer } from 'mobx-react-lite';
import { Timer, History, Flag } from 'lucide-react';

import {
  isSessionEnded,
  resolveClockUrgency,
  splitTime,
} from '@utils/timer-utils';
import { isLapLimitedSession } from '@ui/widgets/StandingsWidget/standings-utils';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { StatPill } from '@ui/shared/StatPill/StatPill';
import {
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './SessionClock.module.scss';

// hh:mm:ss — the pill holds this width whatever the remaining time is.
const CLOCK_WIDTH_CHARS = 8;

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
      <StatPill icon={Flag} className={styles.clockPill}>
        END
      </StatPill>
    );
  }

  const remain = session?.session_time_remain ?? null;
  const elapsed = session?.session_time ?? null;

  const isCountdown = remain !== null && remain >= 0;
  const rawSeconds = isCountdown ? (remain ?? 0) : (elapsed ?? 0);
  const urgency = isCountdown ? resolveClockUrgency(remain) : 'normal';

  const { main, secs } = splitTime(rawSeconds);

  const currentSession =
    sessionInfo?.sessions?.[sessionInfo?.currentSessionNum ?? 0];

  // In a lap race the clock is context, not the thing that ends the session.
  const isLead = !isLapLimitedSession(currentSession?.sessionLaps);

  return (
    <StatPill
      icon={isCountdown ? Timer : History}
      iconTone={urgency === 'normal' ? 'muted' : 'warning'}
      valueDanger={urgency === 'critical'}
      pulse={urgency === 'critical'}
      className={`${styles.clockPill} ${isLead ? styles.clockPillLead : styles.clockPillMuted}`}
    >
      <span
        className={styles.clockValue}
        style={{ minWidth: `${CLOCK_WIDTH_CHARS}ch` }}
      >
        {`${main}${secs}`}
      </span>
    </StatPill>
  );
});
