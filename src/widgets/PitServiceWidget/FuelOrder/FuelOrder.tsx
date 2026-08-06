import { observer } from 'mobx-react-lite';

import styles from './FuelOrder.module.scss';
import { OrderToggle } from '@widgets/PitServiceWidget/OrderToggle/OrderToggle';
import { FuelAdjuster } from '@widgets/PitServiceWidget/FuelAdjuster/FuelAdjuster';
import { formatFuel } from '@utils/formatters/telemetry-format';
import type { UnitSystem } from '@/types';
import {
  usePitServiceWidgetStore,
  useUnitsStore,
} from '@store/root-store-context';

// The sim always reports fuel in liters; only the readout follows the setting.
const fuelUnit = (unitSystem: UnitSystem): string =>
  unitSystem === 'metric' ? 'L' : 'gal';

export const FuelOrder = observer(() => {
  const pitServiceWidget = usePitServiceWidgetStore();
  const units = useUnitsStore();

  // Follows the drag while the bar is being moved, the sim otherwise.
  const ordered = pitServiceWidget.fuelDisplayLiters;

  // Owned by the widget store so the number shown here is exactly the number
  // the order hotkey sends.
  const calculated = pitServiceWidget.plannedFuelLiters;

  return (
    <div className={styles.block}>
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

      {/* Only rendered in interact mode — the overlay owns the mouse there. */}
      <FuelAdjuster />
    </div>
  );
});
