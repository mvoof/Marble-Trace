import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { telemetryStore } from '@store/iracing/telemetry.store';

import styles from './PitWarningAmount.module.scss';

export const PitWarningAmount = observer(() => {
  const fuel = computedStore.fuel;
  const fuelMax = telemetryStore.driverInfo?.DriverCarFuelMaxLtr ?? null;

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
