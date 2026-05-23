import { observer } from 'mobx-react-lite';

import { UnitValueText } from '@/components/shared/UnitValueText/UnitValueText';
import { UnitLabelText } from '@/components/shared/UnitLabelText/UnitLabelText';
import { formatFuel, fuelUnit } from '@utils/formatters/telemetry-format';

import styles from './FuelHeader.module.scss';
import { useTelemetryStore, useUnitsStore } from '@store/root-store-context';
import { NO_FUEL_DATA_PLACEHOLDER } from '@/utils/constants/data-placeholders';

export const FuelHeader = observer(() => {
  const { carStatus } = useTelemetryStore();
  const { unitSystem } = useUnitsStore();

  const fuelLevel = carStatus?.fuel_level ?? null;

  return (
    <div className={styles.header}>
      <UnitLabelText className={styles.headerLabel}>FUEL</UnitLabelText>

      <UnitValueText
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
