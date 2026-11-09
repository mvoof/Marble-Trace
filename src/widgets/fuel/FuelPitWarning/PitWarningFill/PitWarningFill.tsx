import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import {
  formatFuel,
  NO_FUEL_DATA_PLACEHOLDER,
} from '@shared/lib/telemetry-format';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { fuelUnitShort } from '../../fuel-utils';
import styles from './PitWarningFill.module.scss';

export const PitWarningFill = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { unitSystem } = useUnitsStore();

  const fuelToAdd = fuel?.fuelToAddWithBuffer ?? null;

  // The split across remaining stops is `mt-computations/src/strategy/fuel.rs`'s: it already
  // holds the amount and the tank capacity, and the pit order has to dial in
  // the very same number from the main window, which is off the bundle.
  const plan = fuel?.refuelPlan ?? null;
  const isMultiStop = plan !== null && plan.stops > 1;

  return (
    <div className={styles.fill}>
      <div className={styles.amountCell}>
        <span className={styles.amountLabel}>FILL NOW</span>

        <span className={styles.amount}>
          <FixedDigits
            className={styles.amountValue}
            text={
              plan !== null
                ? formatFuel(plan.fillNow, unitSystem)
                : NO_FUEL_DATA_PLACEHOLDER
            }
          />

          <span className={styles.amountUnit}>{fuelUnitShort(unitSystem)}</span>
        </span>
      </div>

      <div className={styles.chips}>
        <StatChip
          lead="+1 LAP BUFFER"
          leadKind="number"
          tone="accent"
          className={styles.bufferChip}
        />

        {/* More than one stop to go: how many, and what they add up to — one
          chip under the buffer, so the plan never pushes the amount aside. */}
        {isMultiStop && (
          <StatChip lead={`${plan.stops} STOPS`} tone="neutral">
            {fuelToAdd !== null
              ? formatFuel(fuelToAdd, unitSystem)
              : NO_FUEL_DATA_PLACEHOLDER}
          </StatChip>
        )}
      </div>
    </div>
  );
});
