import { observer } from 'mobx-react-lite';

import { WidgetValue } from '@/components/WidgetValue/WidgetValue';
import { WidgetLabel } from '@/components/WidgetLabel/WidgetLabel';
import { formatFuel } from '@utils/telemetry-format';
import type { UnitSystem } from '@/types';

import styles from './FuelHeader.module.scss';
import { usePlayerStore, useUnitsStore } from '@store/root-store-context';
import { NO_FUEL_DATA_PLACEHOLDER } from '@utils/telemetry-format';

const fuelUnitWord = (unitSystem: UnitSystem): string =>
  unitSystem === 'metric' ? 'LITERS' : 'GALLONS';

export const FuelHeader = observer(() => {
  const { carStatus } = usePlayerStore();
  const { unitSystem } = useUnitsStore();

  const fuelLevel = carStatus?.fuel_level ?? null;

  return (
    <div className={styles.header}>
      <WidgetLabel className={styles.headerLabel}>FUEL</WidgetLabel>

      <WidgetLabel className={styles.headerLabel}>
        {fuelUnitWord(unitSystem)}
      </WidgetLabel>

      <WidgetValue
        value={
          fuelLevel !== null
            ? formatFuel(fuelLevel, unitSystem)
            : NO_FUEL_DATA_PLACEHOLDER
        }
        className={styles.headerAmount}
      />
    </div>
  );
});
