import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { UNKNOWN_VALUE } from './incident-tracker-utils';
import { useIncidentTrackerStore } from './incident-tracker-context';
import { MetricCell } from './MetricCell';
import styles from './CleanCornersCell.module.scss';

const LABEL = 'CLN';

/**
 * Clean corners still needed for the session to stop costing rating. Zero is
 * the good news: the session is level or better already.
 */
export const CleanCornersCell = observer(() => {
  const needed = useIncidentTrackerStore().cleanCornersNeeded;

  if (needed === null) {
    return (
      <MetricCell label={LABEL} tone="neutral">
        <span className={styles.count}>{UNKNOWN_VALUE}</span>
      </MetricCell>
    );
  }

  return (
    <MetricCell label={LABEL} tone={needed === 0 ? 'positive' : 'warning'}>
      <FixedDigits className={styles.count} text={String(needed)} />
    </MetricCell>
  );
});
