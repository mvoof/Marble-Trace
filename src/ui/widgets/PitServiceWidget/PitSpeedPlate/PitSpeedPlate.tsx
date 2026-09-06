import { observer } from 'mobx-react-lite';

import { usePitServiceWidgetStore } from '@store/root-store-context';

import { PitLimiterRow } from './PitLimiterRow';
import { PitSpeedGauge } from './PitSpeedGauge';
import styles from './PitSpeedPlate.module.scss';

/**
 * One row, three states, and the choice between them is all this component
 * makes: the speed that drives two of them is read inside them.
 *
 * Both flags are the store's to decide, as the auto-service reactions read the
 * limiter bit and what counts as being out of the pits too, and two answers to
 * "are we still bound by the limit" is one too many.
 */
export const PitSpeedPlate = observer(function PitSpeedPlate() {
  const { isPitLimitReleased, isLimiterOn } = usePitServiceWidgetStore();

  if (isPitLimitReleased) {
    return (
      <div className={`${styles.row} ${styles.rowReleased}`}>
        <span className={styles.label}>PIT EXIT</span>

        <span className={styles.readout}>
          <span className={styles.value}>GO!</span>
        </span>
      </div>
    );
  }

  if (isLimiterOn) {
    return <PitLimiterRow />;
  }

  return <PitSpeedGauge />;
});
