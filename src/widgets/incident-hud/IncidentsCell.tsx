import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { useIncidentHudStore } from './incident-hud-context';
import { MetricCell, type MetricTone } from './MetricCell';
import styles from './IncidentsCell.module.scss';

const LABEL = 'INC';

/** Red near or past the limit, amber once the count is off zero. */
const incidentsTone = (count: number, isAlarmed: boolean): MetricTone => {
  if (isAlarmed) {
    return 'danger';
  }

  if (count > 0) {
    return 'warning';
  }

  return 'neutral';
};

/** The session's incident points, over the limit when the session has one. */
export const IncidentsCell = observer(() => {
  const store = useIncidentHudStore();
  const count = store.countedIncidents;
  const limit = store.incidentLimit;
  const tone = incidentsTone(count, store.isDisqualified || store.isNearLimit);

  return (
    <MetricCell label={LABEL} tone={tone}>
      <span>
        <FixedDigits text={String(count)} />
        {limit !== null ? (
          <FixedDigits className={styles.limit} text={`/${limit}`} />
        ) : null}
      </span>
    </MetricCell>
  );
});
