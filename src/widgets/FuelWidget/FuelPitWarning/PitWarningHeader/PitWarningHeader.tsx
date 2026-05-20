import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';

import styles from './PitWarningHeader.module.scss';

export const PitWarningHeader = observer(() => {
  const fuel = computedStore.fuel;

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
