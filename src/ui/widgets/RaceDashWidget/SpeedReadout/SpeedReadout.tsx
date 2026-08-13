import { observer } from 'mobx-react-lite';

import { formatSpeed, speedUnit } from '@utils/telemetry-format';
import { usePlayerStore, useUnitsStore } from '@store/root-store-context';

import styles from './SpeedReadout.module.scss';

export const SpeedReadout = observer(() => {
  const { carDynamics } = usePlayerStore();
  const units = useUnitsStore();

  const speed = carDynamics?.speed ?? 0;

  return (
    <div className={styles.root}>
      <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>

      <span className={styles.value}>
        {formatSpeed(speed, units.unitSystem)}
      </span>
    </div>
  );
});
