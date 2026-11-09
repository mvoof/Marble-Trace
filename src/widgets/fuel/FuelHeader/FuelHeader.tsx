import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import {
  formatFuel,
  NO_FUEL_DATA_PLACEHOLDER,
} from '@shared/lib/telemetry-format';
import type { UnitSystem } from '@shared/contracts/domain';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { fuelUnitShort } from '../fuel-utils';
import { useFuelLapsStatus } from '../use-fuel-status';

import styles from './FuelHeader.module.scss';

const fuelUnitWord = (unitSystem: UnitSystem): string =>
  unitSystem === 'metric' ? 'LITERS' : 'GALLONS';

/** The bar over the widget: what it measures at the left, the tank at the right. */
export const FuelHeader = observer(() => {
  const { carStatus } = usePlayerStore();
  const { unitSystem } = useUnitsStore();
  const lapsStatus = useFuelLapsStatus();

  const fuelLevel = carStatus?.fuel_level ?? null;
  const isLow = lapsStatus === 'danger';

  return (
    <div className={styles.header}>
      <div className={styles.title}>
        <StatChip
          lead={isLow ? 'FUEL LOW' : 'FUEL'}
          leadVariant="solid"
          tone={isLow ? 'danger' : 'positive'}
        />

        <span className={styles.unitWord}>{fuelUnitWord(unitSystem)}</span>
      </div>

      <span className={styles.level}>
        <FixedDigits
          className={styles.levelValue}
          text={
            fuelLevel !== null
              ? formatFuel(fuelLevel, unitSystem)
              : NO_FUEL_DATA_PLACEHOLDER
          }
        />

        <span className={styles.levelUnit}>{fuelUnitShort(unitSystem)}</span>
      </span>
    </div>
  );
});
