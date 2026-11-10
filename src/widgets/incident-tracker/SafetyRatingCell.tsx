import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import { licenseTone } from '@shared/ui/StatChip/rating';
import {
  deltaDirection,
  formatSr,
  type DeltaDirection,
} from './incident-tracker-utils';
import { useIncidentTrackerStore } from './incident-tracker-context';
import styles from './SafetyRatingCell.module.scss';

const DELTA_TONE: Record<DeltaDirection, StatChipTone> = {
  up: 'positive',
  down: 'danger',
  flat: 'muted',
};

/** What a session that moves no rating shows where the change would be. */
const UNRATED_LABEL = 'OFF';

/** Before the roster carries the license, the badge takes the rookie class. */
const UNKNOWN_LICENSE = 'R';

/**
 * The upper tier: the rating as iRacing states it, which holds still through
 * the event, behind a badge in its license class, and a chip with what the
 * event has done to it so far. The chip is an estimate — iRacing publishes no
 * formula.
 */
export const SafetyRatingCell = observer(() => {
  const store = useIncidentTrackerStore();

  return (
    <div className={styles.row}>
      <div className={styles.rating}>
        <StatChip
          className={styles.badge}
          lead="SR"
          look="state"
          tone={licenseTone(store.licString ?? UNKNOWN_LICENSE)}
        />
        <FixedDigits
          className={styles.value}
          text={formatSr(store.srOfficial)}
        />
      </div>

      {store.isRated ? (
        <StatChip
          className={styles.delta}
          look="reading"
          leadKind="number"
          tone={DELTA_TONE[deltaDirection(store.srDelta)]}
          lead={
            <>
              {/* The chip is the model's estimate, never iRacing's number. */}
              <span className={styles.approx}>≃</span>
              <FixedDigits text={store.chipText} />
            </>
          }
        />
      ) : (
        <StatChip
          className={styles.delta}
          look="reading"
          lead={UNRATED_LABEL}
          tone="muted"
        />
      )}
    </div>
  );
});
