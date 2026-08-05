import { observer } from 'mobx-react-lite';

import styles from './PitWarningHeader.module.scss';
import { useBackendComputedStore } from '@store/root-store-context';
import { isPitNow } from '../../fuel-utils';

export const PitWarningHeader = observer(() => {
  const { fuel } = useBackendComputedStore();

  const windowStart = fuel?.pitWindowStart ?? null;
  const windowEnd = fuel?.pitWindowEnd ?? null;

  if (isPitNow(fuel?.lapsRemaining ?? null)) {
    return (
      <>
        <div className={styles.pitWarningHeader}>
          <span className={styles.pitWarningHeaderLabel}>PIT WINDOW</span>

          <span className={styles.pitWarningNow}>NOW!</span>
        </div>

        <div className={styles.pitWarningSeparator} />
      </>
    );
  }

  return (
    <>
      <div className={styles.pitWarningHeader}>
        <span className={styles.pitWarningHeaderLabel}>PIT WINDOW</span>

        <span className={styles.pitWarningWindow}>
          {windowStart !== null ? `LAP ${windowStart}` : 'LAP --'}

          {windowEnd !== null && (
            <span className={styles.pitWarningWindowEnd}>–{windowEnd}</span>
          )}
        </span>
      </div>

      <div className={styles.pitWarningSeparator} />
    </>
  );
});
