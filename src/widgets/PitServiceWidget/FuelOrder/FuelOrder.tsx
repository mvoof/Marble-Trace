import { observer } from 'mobx-react-lite';

import styles from './FuelOrder.module.scss';
import { OrderToggle } from '@widgets/PitServiceWidget/OrderToggle/OrderToggle';
import { formatFuel } from '@utils/formatters/telemetry-format';
import type { UnitSystem } from '@/types';
import {
  usePitServiceWidgetStore,
  usePlayerStore,
  useUnitsStore,
} from '@store/root-store-context';

// The sim always reports fuel in liters; only the readout follows the setting.
const fuelUnit = (unitSystem: UnitSystem): string =>
  unitSystem === 'metric' ? 'L' : 'gal';

export const FuelOrder = observer(() => {
  const { pitService } = usePlayerStore();
  const pitServiceWidget = usePitServiceWidgetStore();
  const units = useUnitsStore();

  const ordered = pitService?.addFuel ? (pitService.fuelAmount ?? 0) : 0;

  // Owned by the widget store so the number shown here is exactly the number
  // the order hotkey sends.
  const calculated = pitServiceWidget.plannedFuelLiters;

  return (
    <OrderToggle
      className={styles.fuel}
      clickableClassName={styles.fuelClickable}
      label="Toggle fuel on the pit order"
      onToggle={() => void pitServiceWidget.toggleFuel()}
    >
      <div className={styles.row}>
        <span className={styles.label}>FUEL ADD</span>

        <span className={styles.value}>
          {ordered > 0 ? `+${formatFuel(ordered, units.unitSystem)}` : '—'}
          <span className={styles.unit}> {fuelUnit(units.unitSystem)}</span>
        </span>
      </div>

      {calculated !== null && (
        <span className={styles.sub}>
          CALC +{formatFuel(calculated, units.unitSystem)}{' '}
          {fuelUnit(units.unitSystem)}
        </span>
      )}
    </OrderToggle>
  );
});
