import { observer } from 'mobx-react-lite';

import { formatFuel, fuelUnit } from '@utils/formatters/telemetry-format';
import { FuelDataCell } from './FuelDataCell/FuelDataCell';

import styles from './FuelDataGrid.module.scss';
import {
  useBackendComputedStore,
  useUnitsStore,
} from '@store/root-store-context';
import { NO_FUEL_DATA_PLACEHOLDER } from '@/utils/constants/data-placeholders';

export const FuelDataGrid = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { unitSystem } = useUnitsStore();

  const shortage = fuel?.shortage ?? null;
  const unit = fuelUnit(unitSystem);

  const shortageText =
    shortage !== null
      ? `${shortage >= 0 ? '+' : ''}${formatFuel(shortage, unitSystem)} ${unit}`
      : `${NO_FUEL_DATA_PLACEHOLDER} ${unit}`;

  const shortageClass =
    shortage !== null && shortage >= 0 ? styles.valueSafe : '';

  const avgPerLap = fuel?.avgPerLap ?? null;
  const avgText =
    avgPerLap !== null
      ? `${formatFuel(avgPerLap, unitSystem)} ${unit}`
      : `${NO_FUEL_DATA_PLACEHOLDER} ${unit}`;

  return (
    <div className={styles.dataGrid}>
      <FuelDataCell label="AVG / LAP" value={avgText} />

      <FuelDataCell
        label="EST. FINISH"
        value={shortageText}
        valueClassName={shortageClass}
      />
    </div>
  );
});
