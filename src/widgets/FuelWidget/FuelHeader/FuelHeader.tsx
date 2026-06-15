import { observer } from 'mobx-react-lite';

import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { formatFuel, fuelUnit } from '@utils/formatters/telemetry-format';

import styles from './FuelHeader.module.scss';
import { usePlayerStore, useUnitsStore } from '@store/root-store-context';
import { NO_FUEL_DATA_PLACEHOLDER } from '@utils/constants/data-placeholders';

export const FuelHeader = observer(() => {
  const { carStatus } = usePlayerStore();
  const { unitSystem } = useUnitsStore();

  const fuelLevel = carStatus?.fuel_level ?? null;

  return (
    <div className={styles.header}>
      <WidgetLabel className={styles.headerLabel}>FUEL</WidgetLabel>

      <WidgetValue
        value={
          fuelLevel !== null
            ? formatFuel(fuelLevel, unitSystem)
            : NO_FUEL_DATA_PLACEHOLDER
        }
        unit={fuelUnit(unitSystem)}
        className={styles.headerAmount}
        unitClassName={styles.headerUnit}
      />
    </div>
  );
});
