import { observer } from 'mobx-react-lite';
import { Info } from 'lucide-react';

import styles from './StaleNotice.module.scss';
import { useTelemetryStore } from '@store/root-store-context';

export const StaleNotice = observer(() => {
  const telemetry = useTelemetryStore();

  const onPitRoad = telemetry.carStatus?.on_pit_road ?? false;

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
