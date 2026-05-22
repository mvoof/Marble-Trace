import { observer } from 'mobx-react-lite';

import styles from './PitWarningAmount.module.scss';
import { useComputedStore, useTelemetryStore } from '@store/root-store-context';

export const PitWarningAmount = observer(() => {
  const computed = useComputedStore();
  const telemetry = useTelemetryStore();

  const fuel = computed.fuel;
  const fuelMax = telemetry.driverInfo?.DriverCarFuelMaxLtr ?? null;

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
      <span className={styles.pitWarningBodyLabel}>{refuelLabel}</span>

      <div className={styles.pitWarningAmountWrap}>
        <span
          className={`${styles.pitWarningAmount} ${isShort ? styles.pitWarningAmountDanger : ''}`}
        >
          {fuelToAddWithBuffer !== null
            ? fuelToAddWithBuffer.toFixed(1)
            : '--.-'}
          <span className={styles.pitWarningAmountUnit}> L</span>
        </span>
      </div>

      <div className={styles.pitWarningBuffer}>
        <span className={styles.pitWarningBodySub}>incl. +1 lap buffer</span>
      </div>
    </div>
  );
});
