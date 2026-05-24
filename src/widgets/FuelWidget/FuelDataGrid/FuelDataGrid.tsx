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
      ? `${shortage >= 0 ? '+' : ''}${formatFuel(shortage, unitSystem)}`
      : NO_FUEL_DATA_PLACEHOLDER;

  const shortageClass =
    shortage !== null && shortage >= 0 ? styles.valueSafe : '';

  const avgPerLap = fuel?.avgPerLap ?? null;
  const avgText =
    avgPerLap !== null
      ? formatFuel(avgPerLap, unitSystem)
      : NO_FUEL_DATA_PLACEHOLDER;

  return (
    <div className={styles.dataGrid}>
      <FuelDataCell label="AVG / LAP" value={avgText} unit={unit} />

      <FuelDataCell
        label="EST. FINISH"
        value={shortageText}
        unit={unit}
        valueClassName={shortageClass}
      />
    </div>
  );
});
