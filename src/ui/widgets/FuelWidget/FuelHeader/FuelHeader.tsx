import { observer } from 'mobx-react-lite';

import { WidgetValue } from '@shared/ui/WidgetValue/WidgetValue';
import { WidgetLabel } from '@shared/ui/WidgetLabel/WidgetLabel';
import { formatFuel } from '@shared/lib/telemetry-format';
import type { UnitSystem } from '@shared/contracts/domain';

import styles from './FuelHeader.module.scss';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { NO_FUEL_DATA_PLACEHOLDER } from '@shared/lib/telemetry-format';

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
