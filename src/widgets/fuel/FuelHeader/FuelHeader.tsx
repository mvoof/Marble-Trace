import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import {
  formatFuel,
  litersToDisplayFuel,
  NO_FUEL_DATA_PLACEHOLDER,
} from '@shared/lib/telemetry-format';
import type { UnitSystem } from '@shared/contracts/domain';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { fuelUnitShort } from '../fuel-utils';
import { useFuelLapsStatus } from '../use-fuel-status';

import styles from './FuelHeader.module.scss';

const fuelUnitWord = (unitSystem: UnitSystem): string =>
  unitSystem === 'metric' ? 'LITERS' : 'GALLONS';

/** The bar over the widget: what it measures at the left, the tank at the right. */
export const FuelHeader = observer(() => {
  const { carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const { unitSystem } = useUnitsStore();
  const lapsStatus = useFuelLapsStatus();

  const fuelLevel = carStatus?.fuel_level ?? null;
  const fuelMax = sessionInfo?.fuelCapacityLtr ?? null;
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

        {/* The tank it is out of, quieter behind the level — the way the
          tables write "12/16". Whole units: a capacity is a round figure. */}
        {fuelMax !== null && fuelMax > 0 && (
          <span className={styles.levelMax}>
            /{Math.round(litersToDisplayFuel(fuelMax, unitSystem))}
          </span>
        )}

        <span className={styles.levelUnit}>{fuelUnitShort(unitSystem)}</span>
      </span>
    </div>
  );
});
