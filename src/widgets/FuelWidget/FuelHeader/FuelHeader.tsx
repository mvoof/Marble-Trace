import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';

import styles from './FuelHeader.module.scss';

export const FuelHeader = observer(() => {
  const fuelLevel = telemetryStore.carStatus?.fuel_level ?? null;

  return (
    <div className={styles.header}>
      <span className={styles.headerLabel}>FUEL</span>
      <span className={styles.headerAmount}>
        {fuelLevel !== null ? fuelLevel.toFixed(1) : '--.-'}
        <span className={styles.headerUnit}> L</span>
      </span>
    </div>
  );
});
