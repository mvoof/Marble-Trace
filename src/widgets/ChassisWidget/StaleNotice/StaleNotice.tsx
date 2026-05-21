import { observer } from 'mobx-react-lite';
import { Info } from 'lucide-react';

import { telemetryStore } from '@store/iracing/telemetry.store';
import styles from './StaleNotice.module.scss';

export const StaleNotice = observer(() => {
  const onPitRoad = telemetryStore.carStatus?.on_pit_road ?? false;

  if (onPitRoad) {
    return null;
  }

  return (
    <div className={styles.staleNotice}>
      <Info size={12} className={styles.staleIcon} />

      <span>Tire data updates only in pits</span>
    </div>
  );
});
