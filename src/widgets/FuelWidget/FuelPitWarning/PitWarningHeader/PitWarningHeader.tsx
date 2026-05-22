import { observer } from 'mobx-react-lite';

import styles from './PitWarningHeader.module.scss';
import { useBackendComputedStore } from '@store/root-store-context';

export const PitWarningHeader = observer(() => {
  const { fuel } = useBackendComputedStore();

  const windowText =
    fuel?.pitWindowStart !== null &&
    fuel?.pitWindowStart !== undefined &&
    fuel?.pitWindowEnd !== null &&
    fuel?.pitWindowEnd !== undefined
      ? `LAP ${fuel.pitWindowStart}-${fuel.pitWindowEnd}`
      : 'LAP -----';

  return (
    <>
      <div className={styles.pitWarningHeader}>
        <span className={styles.pitWarningHeaderLabel}>PIT WINDOW</span>
        <span className={styles.pitWarningWindow}>{windowText}</span>
      </div>

      <div className={styles.pitWarningSeparator} />
    </>
  );
});
