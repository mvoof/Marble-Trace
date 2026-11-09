import { observer } from 'mobx-react-lite';

import { useBlink, type BlinkCycle } from '@shared/hooks/useBlink';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import { useIncidentTrackerStore } from './incident-tracker-context';
import { MetricCell } from './MetricCell';
import styles from './PenaltiesCell.module.scss';

const LABEL = 'PEN';
const DISQUALIFIED_LABEL = 'DQ';

/** One incident more serves the next penalty: the buffer chip blinks. */
const LAST_INCIDENT_BEFORE_PENALTY = 1;

const LAST_INCIDENT_BLINK: BlinkCycle = { stepMs: 400, steps: 2 };

/**
 * Drive-throughs served and, in a chip of their own, the incidents left
 * before the next one — red a point or two off it, blinking at the last.
 * Drawn only in a session that hands out penalties — the widget leaves it out
 * otherwise.
 */
export const PenaltiesCell = observer(() => {
  const store = useIncidentTrackerStore();
  const status = store.penaltyStatus;
  const toNext = store.incidentsToNextPenalty;
  const blinkRef = useBlink<HTMLSpanElement>(
    toNext === LAST_INCIDENT_BEFORE_PENALTY && !store.isDisqualified
      ? LAST_INCIDENT_BLINK
      : null
  );

  if (store.isDisqualified) {
    return (
      <MetricCell label={LABEL} width="wide" tone="danger">
        {DISQUALIFIED_LABEL}
      </MetricCell>
    );
  }

  if (status === null) {
    return null;
  }

  return (
    <MetricCell
      label={LABEL}
      width="wide"
      tone={status.served > 0 ? 'warning' : 'neutral'}
    >
      <FixedDigits text={String(status.served)} />
      {toNext !== null ? (
        <span ref={blinkRef} className={styles.buffer}>
          <StatChip
            lead={`+${toNext}`}
            leadKind="number"
            size="xs"
            tone={store.isNearPenalty ? 'danger' : 'muted'}
          />
        </span>
      ) : null}
    </MetricCell>
  );
});
