import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { UnitValueText } from '@/components/shared/UnitValueText/UnitValueText';
import { UnitLabelText } from '@/components/shared/UnitLabelText/UnitLabelText';

import styles from './FuelHeader.module.scss';

export const FuelHeader = observer(() => {
  const fuelLevel = telemetryStore.carStatus?.fuel_level ?? null;

  return (
    <div className={styles.header}>
      <UnitLabelText className={styles.headerLabel}>FUEL</UnitLabelText>

      <UnitValueText
        value={fuelLevel !== null ? fuelLevel.toFixed(1) : '--.-'}
        unit="L"
        className={styles.headerAmount}
        unitClassName={styles.headerUnit}
      />
    </div>
  );
});
