import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import {
  deltaDirection,
  formatSr,
  formatSrDelta,
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
 * The upper tier: the Safety Rating estimate and its change since the session
 * started. Every figure is an estimate — iRacing publishes no formula.
 */
export const SafetyRatingCell = observer(() => {
  const store = useIncidentHudStore();
  const delta = store.srDelta;
  const deltaClass = DELTA_CLASS[deltaDirection(delta)];

  return (
    <div className={styles.row}>
      <div className={styles.rating}>
        <span className={styles.label}>SR</span>
        <FixedDigits className={styles.value} text={formatSr(store.srShown)} />
      </div>

      <div className={`${styles.delta} ${deltaClass}`}>
        {store.isRated ? (
          <FixedDigits
            text={delta === null ? formatSr(null) : formatSrDelta(delta)}
          />
        ) : (
          UNRATED_LABEL
        )}
      </div>
    </div>
  );
});
