import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { formatFuelLiters } from '@utils/widget/fuel-utils';
import { FuelDataCell } from './FuelDataCell/FuelDataCell';

import styles from './FuelDataGrid.module.scss';

export const FuelDataGrid = observer(() => {
  const fuel = computedStore.fuel;
  const shortage = fuel?.shortage ?? null;

  const shortageText =
    shortage !== null
      ? `${shortage >= 0 ? '+' : ''}${shortage.toFixed(1)}L`
      : '--.-L';

  const shortageClass =
    shortage !== null && shortage >= 0 ? styles.valueSafe : '';

  return (
    <div className={styles.dataGrid}>
      <FuelDataCell
        label="AVG / LAP"
        value={formatFuelLiters(fuel?.avgPerLap ?? null)}
      />
      <FuelDataCell
        label="EST. FINISH"
        value={shortageText}
        valueClassName={shortageClass}
      />
    </div>
  );
});
