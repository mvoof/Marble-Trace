import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import {
  isLapLimitedSession,
  isSessionEnded,
  resolveClockUrgency,
  resolveSessionClock,
  splitTime,
  type ClockUrgency,
} from '@shared/lib/timer-utils';
import { useSessionStore } from '@entities/session/session-context';
import { useBlink, type BlinkCycle } from '@shared/hooks/useBlink';

import { StatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import styles from './SessionClock.module.scss';
import type { StandingsWidgetSettings } from '../settings-schema';

const URGENCY_CLASS: Record<ClockUrgency, string> = {
  normal: '',
  warning: styles.clockWarning,
  critical: styles.clockCritical,
};

// An urgent clock takes its chip with it — a green timer beside a red
// countdown reads as two separate readings.
const URGENCY_TONE: Record<ClockUrgency, StatChipTone> = {
  normal: 'accent',
  warning: 'accent',
  critical: 'danger',
};

// +hh:mm:ss — the widest the clock gets, so the header does not shift when a
// countdown runs out and the elapsed time takes over.
const CLOCK_WIDTH_CHARS = 9;

/** The last minutes of a timed session: the clock dims and returns each second. */
const CRITICAL_BLINK: BlinkCycle = { stepMs: 1000, steps: 2 };

export const SessionClock = observer(() => {
  const { session, sessionInfo } = useSessionStore();

  const settings = useWidgetSettings<StandingsWidgetSettings>('standings');

  const sessionState = session?.session_state ?? null;
  const isEnded = isSessionEnded(sessionState);
  const remain = session?.session_time_remain ?? null;

  const currentSession =
    sessionInfo?.sessions?.[sessionInfo?.currentSessionNum ?? 0];

  // In a lap race the clock is context, not the thing that ends the session.
  const isLapLimited = isLapLimitedSession(
    currentSession?.sessionLaps,
    currentSession?.sessionType
  );

  const { seconds: rawSeconds, isCountdown } = resolveSessionClock(
    remain,
    session?.session_time ?? null,
    isLapLimited
  );

  const urgency = isCountdown ? resolveClockUrgency(remain) : 'normal';

  const clockRef = useBlink<HTMLSpanElement>(
    settings.showSessionTime && !isEnded && urgency === 'critical'
      ? CRITICAL_BLINK
      : null
  );

  if (!settings.showSessionTime) {
    return null;
  }

  if (isEnded) {
    return (
      <StatChip lead="TIME" leadVariant="solid" tone="muted" emphasized>
        END
      </StatChip>
    );
  }

  const { main, secs } = splitTime(rawSeconds);

  const isLead = !isLapLimited;

  // A session past its clock counts up — the "+" is what tells the two apart
  // now that neither carries an icon.
  const prefix = isCountdown ? '' : '+';

  return (
    <StatChip
      lead="TIME"
      leadVariant="solid"
      tone={URGENCY_TONE[urgency]}
      emphasized
    >
      <span
        ref={clockRef}
        className={[
          styles.clockValue,
          isLead ? '' : styles.clockMuted,
          URGENCY_CLASS[urgency],
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ minWidth: `${CLOCK_WIDTH_CHARS}ch` }}
      >
        {`${prefix}${main}${secs}`}
      </span>
    </StatChip>
  );
});
