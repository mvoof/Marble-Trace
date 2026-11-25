import { observer } from 'mobx-react-lite';
import { Clock } from 'lucide-react';

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
import type { StatChipPresentation } from '@shared/contracts/widget-choices';
import { cx } from '@shared/lib/class-names';

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

interface SessionClockProps {
  chipStyle: StatChipPresentation;
  useIcon: boolean;
}

/** The last minutes of a timed session: the clock dims and returns each second. */
const CRITICAL_BLINK: BlinkCycle = { stepMs: 1000, steps: 2 };

export const SessionClock = observer((props: SessionClockProps) => {
  const { chipStyle, useIcon } = props;
  const { session, currentSession } = useSessionStore();

  const sessionState = session?.session_state ?? null;
  const isEnded = isSessionEnded(sessionState);
  const remain = session?.session_time_remain ?? null;

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
    !isEnded && urgency === 'critical' ? CRITICAL_BLINK : null
  );

  if (isEnded) {
    return (
      <StatChip
        presentation={chipStyle}
        lead="TIME"
        labelIcon={useIcon ? Clock : undefined}
        look="reading"
        tone="muted"
      >
        END
      </StatChip>
    );
  }

  const { main, secs } = splitTime(rawSeconds);

  const isLead = !isLapLimited;

  // A session past its clock counts up and carries a "+" prefix.
  const prefix = isCountdown ? '' : '+';

  return (
    <StatChip
      presentation={chipStyle}
      lead="TIME"
      labelIcon={useIcon ? Clock : undefined}
      look="reading"
      tone={URGENCY_TONE[urgency]}
    >
      <span
        ref={clockRef}
        className={cx(
          styles.clockValue,
          chipStyle === 'semantic' ? styles.clockAccent : '',
          isLead ? '' : styles.clockMuted,
          URGENCY_CLASS[urgency]
        )}
        style={{ minWidth: `${CLOCK_WIDTH_CHARS}ch` }}
      >
        {`${prefix}${main}${secs}`}
      </span>
    </StatChip>
  );
});
