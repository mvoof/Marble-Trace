import { observer } from 'mobx-react-lite';

import { formatFuel, fuelUnit } from '@utils/formatters/telemetry-format';
import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';

import styles from './PitWarningAmount.module.scss';
import {
  useBackendComputedStore,
  useTelemetryStore,
  useUnitsStore,
} from '@store/root-store-context';
import { NO_FUEL_DATA_PLACEHOLDER } from '@utils/constants/data-placeholders';

export const PitWarningAmount = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { driverInfo } = useTelemetryStore();
  const { unitSystem } = useUnitsStore();

  const fuelMax = driverInfo?.DriverCarFuelMaxLtr ?? null;

  const fuelToAddWithBuffer = fuel?.fuelToAddWithBuffer ?? null;
  const shortage = fuel?.shortage ?? null;
  const isShort = shortage !== null && shortage < 0;

  const isMultiStop =
    fuelMax !== null &&
    fuelToAddWithBuffer !== null &&
    fuelToAddWithBuffer > fuelMax;

  const refuelLabel = isMultiStop ? 'TOTAL TO ADD' : 'TO REFUEL';

  return (
    <div className={styles.pitWarningRight}>
      <WidgetLabel className={styles.pitWarningBodyLabel}>
        {refuelLabel}
      </WidgetLabel>

      <div className={styles.pitWarningAmountWrap}>
        <WidgetValue
          className={`${styles.pitWarningAmount} ${isShort ? styles.pitWarningAmountDanger : ''}`}
          unitClassName={styles.pitWarningAmountUnit}
          value={
            fuelToAddWithBuffer !== null
              ? formatFuel(fuelToAddWithBuffer, unitSystem)
              : NO_FUEL_DATA_PLACEHOLDER
          }
          unit={fuelUnit(unitSystem)}
        />
      </div>

      <div className={styles.pitWarningBuffer}>
        <span className={styles.pitWarningBodySub}>incl. +1 lap buffer</span>
      </div>
    </div>
  );
});
