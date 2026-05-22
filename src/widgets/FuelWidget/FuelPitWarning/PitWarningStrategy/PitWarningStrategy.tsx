import { observer } from 'mobx-react-lite';

import styles from './PitWarningStrategy.module.scss';
import { useComputedStore, useTelemetryStore } from '@store/root-store-context';

export const PitWarningStrategy = observer(() => {
  const computed = useComputedStore();
  const telemetry = useTelemetryStore();

  const fuel = computed.fuel;
  const fuelMax = telemetry.driverInfo?.DriverCarFuelMaxLtr ?? null;
  const fuelToAddWithBuffer = fuel?.fuelToAddWithBuffer ?? null;

  const isMultiStop =
    fuelMax !== null &&
    fuelToAddWithBuffer !== null &&
    fuelToAddWithBuffer > fuelMax;

  return (
    <div className={styles.pitWarningStrategySlot}>
      {isMultiStop && fuelMax !== null && fuelToAddWithBuffer !== null && (
        <div className={styles.pitWarningStrategy}>
          <div className={styles.strategyRow}>
            <span className={styles.strategyLabel}>STOPS</span>
            <span className={styles.strategyValue}>
              {Math.ceil(fuelToAddWithBuffer / fuelMax)}
            </span>
          </div>

          <div className={styles.strategyDivider} />

          <div className={styles.strategyRow}>
            <span className={styles.strategyLabel}>REC. FILL</span>
            <span className={styles.strategyValue}>
              {(
                fuelToAddWithBuffer / Math.ceil(fuelToAddWithBuffer / fuelMax)
              ).toFixed(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
