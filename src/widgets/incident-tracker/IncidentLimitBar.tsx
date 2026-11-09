import { observer } from 'mobx-react-lite';

import { useIncidentTrackerStore } from './incident-tracker-context';
import styles from './IncidentLimitBar.module.scss';

const PERCENT = 100;

/**
 * A hairline of how much of the incident limit is used — green, red once the
 * limit is close. A session without a limit has nothing to fill and leaves it
 * out.
 */
export const IncidentLimitBar = observer(() => {
  const store = useIncidentTrackerStore();
  const share = store.limitShare;

  if (share === null) {
    return null;
  }

  return (
    <div className={styles.track}>
      <div
        className={`${styles.fill} ${store.isLimitAlarm ? styles.fillAlarm : ''}`}
        style={{ width: `${share * PERCENT}%` }}
      />
    </div>
  );
});
