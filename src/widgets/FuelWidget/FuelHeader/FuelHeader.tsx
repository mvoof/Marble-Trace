import { observer } from 'mobx-react-lite';

import { UnitValueText } from '@/components/shared/UnitValueText/UnitValueText';
import { UnitLabelText } from '@/components/shared/UnitLabelText/UnitLabelText';

import styles from './FuelHeader.module.scss';
import { useTelemetryStore } from '@store/root-store-context';

export const FuelHeader = observer(() => {
  const telemetry = useTelemetryStore();

  const fuelLevel = telemetry.carStatus?.fuel_level ?? null;

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
