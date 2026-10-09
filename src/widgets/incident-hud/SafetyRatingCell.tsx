import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import {
  deltaDirection,
  formatSr,
  type DeltaDirection,
} from './incident-hud-utils';
import { useIncidentHudStore } from './incident-hud-context';
import styles from './SafetyRatingCell.module.scss';

const DELTA_CLASS: Record<DeltaDirection, string> = {
  up: styles.deltaUp,
  down: styles.deltaDown,
  flat: styles.deltaNeutral,
};

/** What a session that moves no rating shows where the change would be. */
const UNRATED_LABEL = 'OFF';

/**
 * The upper tier: the rating as iRacing states it, which holds still through
 * the event, and a chip with what the event has done to it so far. The chip is
 * an estimate — iRacing publishes no formula.
 */
export const SafetyRatingCell = observer(() => {
  const store = useIncidentHudStore();
  const deltaClass = DELTA_CLASS[deltaDirection(store.srDelta)];

  return (
    <div className={styles.row}>
      <div className={styles.rating}>
        <span className={styles.label}>SR</span>
        <FixedDigits
          className={styles.value}
          text={formatSr(store.srOfficial)}
        />
      </div>

      <div className={`${styles.delta} ${deltaClass}`}>
        {store.isRated ? <FixedDigits text={store.chipText} /> : UNRATED_LABEL}
      </div>
    </div>
  );
});
