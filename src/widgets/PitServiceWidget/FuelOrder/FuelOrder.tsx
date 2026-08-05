import { observer } from 'mobx-react-lite';

import styles from './FuelOrder.module.scss';
import { computeRefuelPlan } from '@widgets/FuelWidget/fuel-utils';
import { formatFuel } from '@utils/formatters/telemetry-format';
import type { UnitSystem } from '@/types';
import {
  useBackendComputedStore,
  usePlayerStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

// The sim always reports fuel in liters; only the readout follows the setting.
const fuelUnit = (unitSystem: UnitSystem): string =>
  unitSystem === 'metric' ? 'L' : 'gal';

export const FuelOrder = observer(() => {
  const { pitService } = usePlayerStore();
  const { fuel } = useBackendComputedStore();
  const { sessionInfo } = useSessionStore();
  const units = useUnitsStore();

  const ordered = pitService?.addFuel ? (pitService.fuelAmount ?? 0) : 0;

  // Same number the Fuel widget shows: the buffered recommendation capped by
  // tank capacity. Reading the raw total here would advise an amount that does
  // not fit in the car.
  const plan = computeRefuelPlan(
    fuel?.fuelToAddWithBuffer ?? null,
    sessionInfo?.driverCarFuelMaxLtr ?? null
  );

  const calculated = plan?.fillNow ?? null;

  return (
    <div className={styles.fuel}>
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
    </div>
  );
});
