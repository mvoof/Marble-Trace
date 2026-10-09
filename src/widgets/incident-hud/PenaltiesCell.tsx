import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { useIncidentHudStore } from './incident-hud-context';
import { MetricCell, type MetricTone } from './MetricCell';
import styles from './PenaltiesCell.module.scss';

const LABEL = 'PEN';
const DISQUALIFIED_LABEL = 'DQ';

/** Red a point or two off the next penalty, amber once one is served. */
const penaltiesTone = (served: number, isNearNext: boolean): MetricTone => {
  if (isNearNext) {
    return 'danger';
  }

  if (served > 0) {
    return 'warning';
  }

  return 'neutral';
};

/**
 * Drive-throughs served and the incidents left before the next one. Drawn
 * only in a session that hands out penalties — the widget leaves it out
 * otherwise.
 */
export const PenaltiesCell = observer(() => {
  const store = useIncidentHudStore();
  const status = store.penaltyStatus;
  const toNext = store.incidentsToNextPenalty;

  if (store.isDisqualified) {
    return (
      <MetricCell label={LABEL} tone="danger">
        {DISQUALIFIED_LABEL}
      </MetricCell>
    );
  }

  if (status === null) {
    return null;
  }

  const tone = penaltiesTone(status.served, store.isNearPenalty);

  return (
    <MetricCell label={LABEL} tone={tone}>
      <FixedDigits text={String(status.served)} />
      {toNext !== null ? (
        <FixedDigits className={styles.buffer} text={`+${toNext}`} />
      ) : null}
    </MetricCell>
  );
});
