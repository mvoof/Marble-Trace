import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { useIncidentTrackerStore } from './incident-tracker-context';
import { MetricCell } from './MetricCell';
import styles from './IncidentsCell.module.scss';

const LABEL = 'INC';

/**
 * The session's incident points, over the limit when the session has one —
 * white until the limit is close, red from there.
 */
export const IncidentsCell = observer(() => {
  const store = useIncidentTrackerStore();
  const limit = store.incidentLimit;
  const isAlarmed = store.isLimitAlarm;

  return (
    <MetricCell
      label={LABEL}
      width="normal"
      tone={isAlarmed ? 'danger' : 'neutral'}
      isLabelAlarmed={isAlarmed}
    >
      <span>
        <FixedDigits text={String(store.countedIncidents)} />
        {limit !== null ? (
          <FixedDigits className={styles.limit} text={`/${limit}`} />
        ) : null}
      </span>
    </MetricCell>
  );
});
